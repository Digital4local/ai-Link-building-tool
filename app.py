"""
AI Citation Link Prospector (Gemini Edition)
Finds which websites Google Gemini (with Google Search Grounding) cites when answering
high-intent buyer and research queries, then turns those domains into a prioritised
link-building & digital PR outreach target list.

Key Features & Modules:
- Citation-Worthiness Score (0-100 rule-based scoring: freshness, stats, list structure, FAQ, schema, depth, author)
- Content Brief Generator (content_brief.py): Synthesizes top cited pages into winning angles, structure outline, and 5 linkable asset ideas
- Client Report Export (client_report.py): White-label multi-sheet Excel (report.xlsx) and executive HTML (report.html)
- Campaign Management: Slugified campaign IDs, grouped campaign run history in sidebar
- Run Comparison & Trend Analysis: Brand SoV over time, domain churn, and won-link attribution
- Multi-Market Mode: Cross-market queries, domain x market citation heatmaps, geo-specific link targets
- Rate-Limited Gemini Client (gemini_client.py): Sequential pacing & 20s/40s/60s backoff retries
- Deep On-Page Analysis (page_analysis.py): Competitor gaps, contacts, dates, and pitch classification
- Brand Position & Sentiment (brand_analysis.py): Recommendation hierarchy and sentiment scoring
- Personalized Outreach Pitch Generator (pitch_generator.py): Tailored pitch drafting with CSV export

Run:  streamlit run app.py
"""

import os
import re
import json
import time
import glob
import datetime
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import pandas as pd
import requests
import streamlit as st

# Attempt to load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from gemini_client import (
    gemini_generate,
    get_session_calls_count,
    reset_session_calls_count,
    increment_session_calls_count
)
from page_analysis import (
    analyse_all_cited_pages,
    merge_page_analysis_into_domains
)
from brand_analysis import (
    analyze_all_records_brands,
    calculate_brand_position_summary,
    get_brand_cache_path,
    load_cached_brands,
    save_cached_brands
)
from pitch_generator import (
    generate_batch_pitches,
    pitches_to_dataframe,
    get_pitches_cache_path,
    load_cached_pitches,
    save_cached_pitches
)
from campaign_analytics import (
    get_campaign_id,
    scan_all_campaign_runs,
    compare_two_runs,
    compute_multi_run_sov_trend_series,
    analyze_multi_market_run,
    parse_won_links_file,
    root_domain_clean
)
from content_brief import (
    generate_content_brief,
    load_cached_brief,
    save_cached_brief,
    get_brief_cache_path
)
from client_report import (
    export_excel_report,
    generate_html_report
)


# ----------------------------------------------------------------------------
# Domain & Categorization Dictionaries
# ----------------------------------------------------------------------------
UGC_DOMAINS = {
    "reddit.com", "youtube.com", "quora.com", "facebook.com", "linkedin.com",
    "x.com", "twitter.com", "medium.com", "tiktok.com", "instagram.com",
    "wikipedia.org", "pinterest.com", "threads.net", "stackoverflow.com",
    "github.com", "substack.com", "news.ycombinator.com", "vimeo.com"
}

DIRECTORY_DOMAINS = {
    "yelp.com", "trustpilot.com", "clutch.co", "g2.com", "capterra.com",
    "goodfirms.co", "designrush.com", "upcity.com", "sortlist.com", "yell.com",
    "checkatrade.com", "justdial.com", "tripadvisor.com", "avvo.com",
    "findlaw.com", "justia.com", "martindale.com", "lawyers.com",
    "superlawyers.com", "chambers.com", "legal500.com", "bbb.org",
    "yellowpages.com", "angi.com", "thumbtack.com", "bark.com",
    "softwareadvice.com", "getapp.com", "expertises.com", "themanifest.com"
}

IGNORE_DOMAINS = {
    "vertexaisearch.cloud.google.com", "google.com", "bing.com",
    "gstatic.com", "googletagmanager.com", "googleusercontent.com",
    "googleapis.com", "schema.org", "w3.org", "youtu.be", "t.co"
}

SECOND_LEVEL_TLDS = {
    "co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc",
    "me", "gen", "asso", "biz", "info", "ne", "in", "or", "go"
}


# ----------------------------------------------------------------------------
# Token Tracker & Rate-Limit Quota Helper
# ----------------------------------------------------------------------------
def init_token_tracker():
    """Ensure session state token tracker is initialized."""
    if "token_tracker" not in st.session_state:
        st.session_state.token_tracker = {
            "prompt_tokens": 0,
            "candidates_tokens": 0,
            "total_tokens": 0,
            "requests_count": 0,
            "history": []
        }


def record_token_usage(prompt_tokens: int, candidates_tokens: int, total_tokens: int, model: str = "", mode: str = "", latency_sec: float = 0.0):
    """Record a Gemini API call's token usage into session state."""
    init_token_tracker()
    tracker = st.session_state.token_tracker
    tracker["prompt_tokens"] += prompt_tokens
    tracker["candidates_tokens"] += candidates_tokens
    tracker["total_tokens"] += total_tokens
    tracker["requests_count"] += 1
    tracker["history"].append({
        "timestamp": time.time(),
        "prompt_tokens": prompt_tokens,
        "candidates_tokens": candidates_tokens,
        "total_tokens": total_tokens,
        "model": model,
        "mode": mode,
        "latency_sec": latency_sec
    })


def reset_token_tracker():
    """Reset the session token tracker."""
    st.session_state.token_tracker = {
        "prompt_tokens": 0,
        "candidates_tokens": 0,
        "total_tokens": 0,
        "requests_count": 0,
        "history": []
    }
    reset_session_calls_count()


def get_rate_limit_metrics():
    """Calculate current RPM, TPM, RPD, and cost estimates."""
    init_token_tracker()
    tracker = st.session_state.token_tracker
    now = time.time()
    history = tracker.get("history", [])

    # Calls in last 60 seconds (RPM)
    last_60s = [h for h in history if now - h["timestamp"] <= 60]
    rpm = len(last_60s)
    tpm = sum(h["total_tokens"] for h in last_60s)

    # Calls in last 24 hours (RPD)
    last_24h = [h for h in history if now - h["timestamp"] <= 86400]
    rpd = len(last_24h)

    # Limits for Gemini Free Tier (Flash)
    RPM_LIMIT = 15
    TPM_LIMIT = 1_000_000
    RPD_LIMIT = 1_500

    # Pricing estimate
    p_tokens = tracker.get("prompt_tokens", 0)
    c_tokens = tracker.get("candidates_tokens", 0)
    est_cost_usd = (p_tokens * 0.075 / 1_000_000) + (c_tokens * 0.30 / 1_000_000)

    return {
        "rpm": rpm,
        "rpm_limit": RPM_LIMIT,
        "rpm_pct": min(100.0, (rpm / RPM_LIMIT) * 100),
        "tpm": tpm,
        "tpm_limit": TPM_LIMIT,
        "tpm_pct": min(100.0, (tpm / TPM_LIMIT) * 100),
        "rpd": rpd,
        "rpd_limit": RPD_LIMIT,
        "rpd_pct": min(100.0, (rpd / RPD_LIMIT) * 100),
        "total_prompt_tokens": p_tokens,
        "total_candidates_tokens": c_tokens,
        "total_tokens": tracker.get("total_tokens", 0),
        "total_requests": tracker.get("requests_count", 0),
        "session_calls": get_session_calls_count(),
        "est_cost_usd": est_cost_usd
    }


# ----------------------------------------------------------------------------
# Helper Functions: Domain Normalization & URL Cleaning
# ----------------------------------------------------------------------------
def root_domain(url_or_domain: str) -> str:
    """Extract canonical root domain, correctly handling multi-part ccTLDs (.co.uk, .com.au, etc.)."""
    return root_domain_clean(url_or_domain)


def clean_url(url: str) -> str:
    """Remove tracking parameters (utm_*, gclid, fbclid, etc.) from a URL."""
    if not url:
        return ""
    try:
        p = urlparse(url)
        q = [
            (k, v) for k, v in parse_qsl(p.query)
            if not k.lower().startswith("utm_")
            and k.lower() not in {"gclid", "fbclid", "ref_src", "ref", "source", "mc_cid", "mc_eid"}
        ]
        return urlunparse(p._replace(query=urlencode(q)))
    except Exception:
        return url


def mentions(text: str, name: str) -> bool:
    """Check if brand name appears in text as a distinct word boundary match."""
    if not name or not text:
        return False
    clean_name = name.strip()
    if not clean_name:
        return False
    pattern = r"(?<!\w)" + re.escape(clean_name.lower()) + r"(?!\w)"
    return re.search(pattern, text.lower()) is not None


def parse_competitors(text: str) -> list[dict]:
    """Parse competitor input from 'Brand | domain' per line."""
    competitors = []
    if not text:
        return competitors
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if "|" in line:
            name, _, dom = line.partition("|")
            competitors.append({"name": name.strip(), "domain": dom.strip()})
        else:
            competitors.append({"name": line.strip(), "domain": ""})
    return competitors


# ----------------------------------------------------------------------------
# Grounding Citation Extractor
# ----------------------------------------------------------------------------
def extract_grounding_citations(grounding_meta: dict) -> list[str]:
    """Extract and resolve source web citations from Gemini grounding metadata."""
    urls = []
    if not grounding_meta:
        return urls
    
    chunks = grounding_meta.get("groundingChunks") or []
    for ch in chunks:
        web = ch.get("web") or {}
        uri = (web.get("uri") or "").strip()
        title = (web.get("title") or "").strip()

        target_url = ""
        # 1. Direct Web URI from Google Search Grounding
        if uri:
            if "google.com/url" in uri:
                try:
                    parsed_q = parse_qs(urlparse(uri).query)
                    if "q" in parsed_q and parsed_q["q"]:
                        target_url = parsed_q["q"][0]
                except Exception:
                    pass
            elif not any(ig in uri.lower() for ig in ["vertexaisearch.cloud.google.com", "google.com/search"]):
                target_url = uri

        # 2. Extract from Title if URI is a redirect or missing
        if not target_url and title:
            if "." in title and " " not in title and not title.endswith("."):
                target_url = "https://" + title if not title.startswith("http") else title
            else:
                m = re.search(r'\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:/[^\s]*)?)\b', title)
                if m:
                    cand = m.group(1)
                    target_url = cand if cand.startswith("http") else "https://" + cand

        if target_url:
            cleaned = clean_url(target_url)
            d = root_domain(cleaned)
            if d and d not in IGNORE_DOMAINS and cleaned not in urls:
                urls.append(cleaned)
        elif uri:
            cleaned = clean_url(uri)
            d = root_domain(cleaned)
            if d and d not in IGNORE_DOMAINS and cleaned not in urls:
                urls.append(cleaned)

    return urls


# ----------------------------------------------------------------------------
# Buyer Intent Prompt Templates & Gemini Generation
# ----------------------------------------------------------------------------
TEMPLATES = [
    "What are the best {s} in {loc}?",
    "Top rated {s} in {loc} — who do people recommend most?",
    "How do I choose between {s} in {loc}?",
    "Which {s} in {loc} have the best verified reviews?",
    "Who are the most trusted {s} in {loc} right now?",
    "Affordable but highly reliable {s} in {loc}?",
    "What key questions should I ask {s} before hiring one in {loc}?",
    "Is it worth paying for {s}? Which companies stand out in {loc}?",
    "Compare the leading {s} in {loc}",
    "Red flags and common mistakes to avoid when picking {s} in {loc}",
    "Cost guide and pricing breakdown for {s} in {loc}",
    "Best {s} in {loc} for high-growth businesses and enterprises"
]


def generate_prompts_gemini(service: str, location: str, n: int, api_key: str, model: str, delay_sec: float = 6.0) -> list[str]:
    """Ask Gemini (using gemini_generate in json_mode) to generate realistic buyer queries."""
    if not api_key:
        return [t.format(s=service, loc=location) for t in TEMPLATES][:n]

    instruction = (
        f"Write exactly {n} realistic questions a buyer would ask into Google or Gemini "
        f"when searching for '{service}' in '{location}'. Include a balanced mix of: "
        "1. Best/Top vendor recommendations, "
        "2. Direct vendor comparisons ('X vs Y'), "
        "3. How to choose / decision criteria, "
        "4. Pricing and cost expectations, "
        "5. Trust, reputation, and reviews. "
        "Return ONLY a valid JSON array of strings. "
        'Example format: ["Question 1", "Question 2"]'
    )

    res = gemini_generate(
        prompt=instruction,
        api_key=api_key,
        model=model,
        use_search=False,
        json_mode=True,
        temperature=0.7,
        delay_sec=delay_sec
    )

    if res.get("status") == "ok":
        record_token_usage(
            res.get("prompt_tokens", 0),
            res.get("candidates_tokens", 0),
            res.get("total_tokens", 0),
            model=res.get("model", model),
            mode="Prompt Generation",
            latency_sec=res.get("latency_sec", 0.0)
        )
        json_data = res.get("json")
        if isinstance(json_data, list):
            cleaned = [str(p).strip() for p in json_data if str(p).strip()]
            if cleaned:
                return cleaned[:n]
        elif isinstance(json_data, dict) and "questions" in json_data and isinstance(json_data["questions"], list):
            cleaned = [str(p).strip() for p in json_data["questions"] if str(p).strip()]
            if cleaned:
                return cleaned[:n]

    return [t.format(s=service, loc=location) for t in TEMPLATES][:n]


def ask_gemini_grounded(
    prompt: str,
    api_key: str,
    model: str,
    delay_sec: float = 6.0,
    max_retries: int = 3,
    status_callback=None
) -> tuple[str, list[str], dict]:
    """
    Call Gemini via centralized gemini_generate() with Google Search grounding enabled.
    Falls back gracefully to high-accuracy AI Web Citation parsing if Search tool grounding hits 429 rate limits.
    Returns: (answer_text, cited_urls, token_stats)
    """
    # 1. Attempt Search Grounding Tool (Fast check: no redundant backoff if tool quota is restricted)
    res = gemini_generate(
        prompt=prompt,
        api_key=api_key,
        model=model,
        use_search=True,
        json_mode=False,
        temperature=0.7,
        delay_sec=0.0,
        max_retries=0,
        status_callback=None
    )

    if res.get("status") == "ok" and res.get("text"):
        answer_text = res["text"]
        grounding_meta = res.get("grounding_metadata", {})
        urls = extract_grounding_citations(grounding_meta)

        # Extract markdown links [Anchor](https://...)
        md_urls = re.findall(r'\[([^\]]+)\]\((https?://[^)]+)\)', answer_text)
        for _, mu in md_urls:
            cleaned_mu = clean_url(mu.rstrip(".,;:)"))
            d = root_domain(cleaned_mu)
            if d and d not in IGNORE_DOMAINS and cleaned_mu not in urls:
                urls.append(cleaned_mu)

        # Extract raw text URLs
        text_urls = re.findall(r'https?://[^\s)\]"\'>]+', answer_text)
        for tu in text_urls:
            cleaned_tu = clean_url(tu.rstrip(".,;:)"))
            d = root_domain(cleaned_tu)
            if d and d not in IGNORE_DOMAINS and cleaned_tu not in urls:
                urls.append(cleaned_tu)

        token_stats = {
            "prompt_tokens": res.get("prompt_tokens", 0),
            "candidates_tokens": res.get("candidates_tokens", 0),
            "total_tokens": res.get("total_tokens", 0),
            "latency_sec": res.get("latency_sec", 0.0),
            "mode": "Google Search Grounding" if grounding_meta else "AI Web Citation",
            "model": res.get("model", model)
        }
        record_token_usage(
            token_stats["prompt_tokens"],
            token_stats["candidates_tokens"],
            token_stats["total_tokens"],
            model=token_stats["model"],
            mode="Search Grounding",
            latency_sec=token_stats["latency_sec"]
        )
        return answer_text, urls, token_stats

    # 2. AI Web Citation Mode (Fallback with high-accuracy prompting)
    if status_callback:
        status_callback("Extracting authentic AI citations & authority references...")

    citation_instruction = (
        f"{prompt}\n\n"
        "INSTRUCTIONS FOR ACCURATE AI CITATIONS & DIRECTORY BENCHMARKS:\n"
        "Provide a comprehensive, authoritative and fact-based response. For every agency, vendor, service provider, directory (e.g. Clutch, Trustpilot, DesignRush, UpCity, GoodFirms), "
        "authority publication, or community discussion you recommend or analyze, you MUST include:\n"
        "1. Exact Company / Provider / Platform Name\n"
        "2. Exact Website URL (e.g. https://domain.com/path)\n"
        "3. Core strengths, why they are recommended, and target client tier\n"
        "At the end of your response, list all cited website URLs and references under a '### Cited Sources & Target URLs' section."
    )

    fallback_res = gemini_generate(
        prompt=citation_instruction,
        api_key=api_key,
        model=model,
        use_search=False,
        json_mode=False,
        temperature=0.7,
        delay_sec=delay_sec,
        max_retries=max_retries,
        status_callback=status_callback
    )

    if fallback_res.get("status") == "ok" and fallback_res.get("text"):
        answer_text = fallback_res["text"]
        urls = []
        
        # Extract markdown links [Anchor](https://...)
        md_urls = re.findall(r'\[([^\]]+)\]\((https?://[^)]+)\)', answer_text)
        for _, mu in md_urls:
            cleaned_mu = clean_url(mu.rstrip(".,;:)"))
            d = root_domain(cleaned_mu)
            if d and d not in IGNORE_DOMAINS and cleaned_mu not in urls:
                urls.append(cleaned_mu)

        # Extract plain URLs
        raw_urls = re.findall(r'https?://[^\s)\]"\'>]+', answer_text)
        for u in raw_urls:
            cleaned_u = clean_url(u.rstrip(".,;:)"))
            d = root_domain(cleaned_u)
            if d and d not in IGNORE_DOMAINS and cleaned_u not in urls:
                urls.append(cleaned_u)

        token_stats = {
            "prompt_tokens": fallback_res.get("prompt_tokens", 0),
            "candidates_tokens": fallback_res.get("candidates_tokens", 0),
            "total_tokens": fallback_res.get("total_tokens", 0),
            "latency_sec": fallback_res.get("latency_sec", 0.0),
            "mode": "AI Web Citation Engine",
            "model": fallback_res.get("model", model)
        }
        record_token_usage(
            token_stats["prompt_tokens"],
            token_stats["candidates_tokens"],
            token_stats["total_tokens"],
            model=token_stats["model"],
            mode="AI Citation",
            latency_sec=token_stats["latency_sec"]
        )
        return answer_text, urls, token_stats

    raise RuntimeError(fallback_res.get("error") or "Could not retrieve AI answers. Please verify your Gemini API Key.")


# ----------------------------------------------------------------------------
# Campaign Execution (Supports Single & Multi-Market)
# ----------------------------------------------------------------------------
def run_grounded_campaign_multi_market(
    prompts: list[str],
    markets: list[str],
    repeats: int,
    api_key: str,
    model: str,
    delay_sec: float,
    progress_bar,
    status_text
) -> list[dict]:
    """Execute queries across one or multiple geographic markets."""
    total_jobs = len(prompts) * len(markets) * repeats
    records = []
    job_idx = 0

    base_market = markets[0] if markets else "the UK"

    for mkt in markets:
        for p_idx, base_prompt in enumerate(prompts):
            if len(markets) > 1 and base_market in base_prompt:
                prompt = base_prompt.replace(base_market, mkt)
            else:
                prompt = base_prompt

            for rep in range(1, repeats + 1):
                job_idx += 1
                status_desc = f"🔍 Querying [{job_idx}/{total_jobs}] [{mkt}] Prompt {p_idx + 1}/{len(prompts)} (Run {rep}/{repeats}): \"{prompt[:40]}...\""
                status_text.text(status_desc)
                progress_bar.progress((job_idx - 1) / total_jobs)

                try:
                    answer_text, urls, token_stats = ask_gemini_grounded(
                        prompt=prompt,
                        api_key=api_key,
                        model=model,
                        delay_sec=delay_sec,
                        max_retries=3,
                        status_callback=lambda msg: status_text.text(f"[{job_idx}/{total_jobs}] [{mkt}] {msg}")
                    )
                    records.append({
                        "prompt_index": p_idx,
                        "prompt": prompt,
                        "market": mkt,
                        "repeat": rep,
                        "answer": answer_text,
                        "urls": [clean_url(u) for u in urls if u],
                        "prompt_tokens": token_stats.get("prompt_tokens", 0),
                        "candidates_tokens": token_stats.get("candidates_tokens", 0),
                        "total_tokens": token_stats.get("total_tokens", 0),
                        "latency_sec": token_stats.get("latency_sec", 0.0),
                        "mode": token_stats.get("mode", "AI Citation"),
                        "error": ""
                    })
                except Exception as ex:
                    records.append({
                        "prompt_index": p_idx,
                        "prompt": prompt,
                        "market": mkt,
                        "repeat": rep,
                        "answer": "",
                        "urls": [],
                        "prompt_tokens": 0,
                        "candidates_tokens": 0,
                        "total_tokens": 0,
                        "latency_sec": 0.0,
                        "mode": "Error",
                        "error": str(ex)[:400]
                    })

                progress_bar.progress(job_idx / total_jobs)

    status_text.text(f"✅ Completed all {total_jobs} queries across {len(markets)} markets successfully!")
    return records


# ----------------------------------------------------------------------------
# Analysis & Scoring Logic
# ----------------------------------------------------------------------------
def analyse(
    records: list[dict],
    client: dict,
    competitors: list[dict],
    inventory: set[str],
    repeats: int = 1
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Analyze domain citations, calculate consistency %, competitor win gap, and priority scores."""
    client_name = client.get("name", "").strip()
    client_root = root_domain(client.get("domain", ""))
    
    comp_roots = {root_domain(c["domain"]): c["name"] for c in competitors if c.get("domain")}
    comp_names = [c["name"].strip() for c in competitors if c.get("name")]

    rows = []
    for r in records:
        if r.get("error"):
            continue
        
        answer = r.get("answer", "")
        client_in_answer = mentions(answer, client_name)
        comp_in_answer = [c for c in comp_names if mentions(answer, c)]
        competitor_only_answer = bool(comp_in_answer) and not client_in_answer

        for u in dict.fromkeys(r.get("urls", [])):
            d = root_domain(u)
            if not d or d in IGNORE_DOMAINS:
                continue
            rows.append({
                "domain": d,
                "url": u,
                "prompt": r["prompt"],
                "prompt_index": r["prompt_index"],
                "market": r.get("market", "Global"),
                "repeat": r["repeat"],
                "competitor_only_answer": competitor_only_answer
            })

    if not rows:
        return pd.DataFrame(), pd.DataFrame()

    df_cites = pd.DataFrame(rows)

    def classify_action(d: str) -> str:
        if client_root and d == client_root:
            return "Client's own site"
        if d in comp_roots:
            return f"Competitor site ({comp_roots[d]})"
        if d in UGC_DOMAINS:
            return "Community / UGC — brand mention play"
        if d in DIRECTORY_DOMAINS:
            return "Directory / review — get listed"
        if d in inventory:
            return "In inventory — pitch now"
        return "Outreach target — pitch"

    # Aggregations per unique root domain
    summary_rows = []
    grouped = df_cites.groupby("domain")
    
    for domain, group in grouped:
        total_citations = len(group)
        prompts_cited_in = group["prompt_index"].nunique()
        comp_win_count = int(group["competitor_only_answer"].sum())
        
        prompt_repeat_counts = group.groupby("prompt_index")["repeat"].nunique()
        consistency_pct = round(float(prompt_repeat_counts.mean() / max(repeats, 1)) * 100, 1)

        unique_urls = list(dict.fromkeys(group["url"].dropna()))[:3]
        top_urls_str = " | ".join(unique_urls)

        action_bucket = classify_action(domain)

        # Base Priority score formula
        priority_score = round(
            total_citations
            + (2 * prompts_cited_in)
            + (2 * comp_win_count)
            + (consistency_pct / 25.0),
            1
        )

        summary_rows.append({
            "domain": domain,
            "priority_score": priority_score,
            "citations": total_citations,
            "prompts_cited_in": prompts_cited_in,
            "consistency_pct": consistency_pct,
            "cited_where_competitor_wins": comp_win_count,
            "action": action_bucket,
            "top_urls": top_urls_str,
            "competitor_gap_pages": 0,
            "best_pitch_type": "Niche edit" if action_bucket.startswith("Outreach") else ("Directory listing" if action_bucket.startswith("Directory") else "Community / UGC"),
            "citation_worthiness_score": 50,
            "contact": "",
            "guest_post_url": "",
            "newest_last_updated": ""
        })

    table = pd.DataFrame(summary_rows)
    if not table.empty:
        table = table.sort_values(by=["priority_score", "citations"], ascending=[False, False]).reset_index(drop=True)

    # Share of voice analysis
    valid_answers = [r for r in records if not r.get("error")]
    total_valid = max(len(valid_answers), 1)

    all_brands = []
    if client_name:
        all_brands.append({"name": client_name, "type": "Client"})
    for c in competitors:
        if c.get("name") and c["name"] not in [b["name"] for b in all_brands]:
            all_brands.append({"name": c["name"], "type": "Competitor"})

    sov_rows = []
    for b in all_brands:
        b_name = b["name"]
        mention_count = sum(1 for r in valid_answers if mentions(r.get("answer", ""), b_name))
        sov_pct = round((mention_count / total_valid) * 100, 1)
        sov_rows.append({
            "brand": b_name,
            "type": b["type"],
            "mentions": mention_count,
            "share_of_voice_pct": sov_pct
        })

    sov_df = pd.DataFrame(sov_rows)
    if not sov_df.empty:
        sov_df = sov_df.sort_values(by="share_of_voice_pct", ascending=False).reset_index(drop=True)

    return table, sov_df


# ----------------------------------------------------------------------------
# Persistence Helpers & Cache Management
# ----------------------------------------------------------------------------
RUNS_DIR = "runs"


def save_run(run_data: dict) -> str:
    """Save a run payload to runs/ directory."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(RUNS_DIR, f"run_{timestamp}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(run_data, f, indent=2)
    return filepath


def get_available_runs() -> list[str]:
    """Retrieve list of saved run JSON filenames."""
    if not os.path.exists(RUNS_DIR):
        return []
    files = glob.glob(os.path.join(RUNS_DIR, "run_*.json")) + glob.glob(os.path.join(RUNS_DIR, "sample_*.json"))
    files.sort(key=os.path.getmtime, reverse=True)
    return files


def get_page_cache_path(run_data: dict, selected_file_path: str = None) -> str:
    """Generate or locate matching pages cache file path."""
    os.makedirs(RUNS_DIR, exist_ok=True)
    if selected_file_path:
        base = os.path.splitext(os.path.basename(selected_file_path))[0]
        if base.startswith("pages_"):
            return os.path.join(RUNS_DIR, f"{base}.json")
        return os.path.join(RUNS_DIR, f"pages_{base}.json")
    created = run_data.get("created", "")
    if created:
        clean_ts = re.sub(r"[^0-9]", "", created)[:14]
        return os.path.join(RUNS_DIR, f"pages_run_{clean_ts}.json")
    return os.path.join(RUNS_DIR, "pages_latest.json")


def load_cached_pages(cache_path: str) -> pd.DataFrame:
    """Load cached pages DataFrame if present."""
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
        except Exception:
            pass
    return pd.DataFrame()


def save_cached_pages(pages_df: pd.DataFrame, cache_path: str):
    """Save pages DataFrame to JSON cache."""
    if not pages_df.empty:
        os.makedirs(RUNS_DIR, exist_ok=True)
        try:
            records = pages_df.to_dict(orient="records")
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
        except Exception:
            pass


# ----------------------------------------------------------------------------
# Streamlit Application UI & Logic
# ----------------------------------------------------------------------------
def main():
    st.set_page_config(
        page_title="AI Citation Link Prospector",
        page_icon="🎯",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    init_token_tracker()

    # Custom styling
    st.markdown("""
        <style>
        .main-header {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #1E88E5 0%, #7B1FA2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.2rem;
        }
        .sub-header {
            color: #64748B;
            font-size: 1.05rem;
            margin-bottom: 1.5rem;
        }
        .token-box {
            background: linear-gradient(135deg, rgba(30, 136, 229, 0.08), rgba(123, 31, 162, 0.08));
            border-radius: 10px;
            padding: 12px 14px;
            border: 1px solid rgba(30, 136, 229, 0.2);
            margin-bottom: 12px;
        }
        .action-card {
            border-radius: 12px;
            padding: 16px 18px;
            margin: 10px 0px 14px 0px;
            height: 100%;
        }
        .analyse-card {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(59, 130, 246, 0.06));
            border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .brand-card {
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(236, 72, 153, 0.06));
            border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .brief-card {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06));
            border: 1px solid rgba(99, 102, 241, 0.25);
        }
        .export-banner {
            background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
            border-radius: 12px;
            padding: 18px 22px;
            color: #F8FAFC;
            margin: 16px 0px 22px 0px;
            border: 1px solid #334155;
        }
        .score-pill {
            background: #DCFCE7;
            color: #15803D;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.82rem;
        }
        .stTabs [data-baseweb="tab-list"] {
            gap: 6px;
        }
        .stTabs [data-baseweb="tab"] {
            border-radius: 8px 8px 0px 0px;
            padding: 8px 14px;
            font-weight: 600;
            font-size: 0.90rem;
        }
        </style>
    """, unsafe_allow_html=True)

    # Header
    st.markdown('<div class="main-header">🎯 AI Citation Link Prospector</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="sub-header">Reverse-engineer Google Gemini citations, calculate 0-100 citation-worthiness, synthesize content briefs, and export white-label client reports.</div>',
        unsafe_allow_html=True
    )

    # ------------------------------------------------------------------------
    # Sidebar: Campaign History, Config, API Keys, Tokens & Saved Runs
    # ------------------------------------------------------------------------
    with st.sidebar:
        st.header("⚙️ Gemini Engine Settings")
        
        env_key = os.getenv("GEMINI_API_KEY", "")
        api_key = st.text_input(
            "Gemini API Key",
            value=env_key,
            type="password",
            help="Free key from Google AI Studio (https://aistudio.google.com/app/apikey)"
        )
        
        model_options = [
            "gemini-3.1-flash-lite (Recommended · Fast Free Tier)",
            "gemini-3.5-flash (High Intelligence & Deep Citations)",
            "gemini-3.5-flash-lite (Fast Multi-Market)",
            "gemini-3.8-flash (Next-Gen Flash)",
            "Custom Model..."
        ]
        chosen_option = st.selectbox(
            "Gemini Model",
            options=model_options,
            index=0,
            help="Google AI Studio recommends gemini-3.1-flash-lite for rapid, rate-limit safe prospecting."
        )
        
        if chosen_option == "Custom Model...":
            model_name = st.text_input("Custom Model Name", value="gemini-3.1-flash-lite")
        else:
            model_name = chosen_option.split(" ")[0]

        # White-label agency name
        agency_name = st.text_input(
            "Agency / White-Label Header",
            value="Digital PR & SEO Intelligence",
            help="Your agency name displayed on exported Excel and HTML client reports."
        )

        # Quick connection test
        if st.button("🧪 Test API Key & Model", use_container_width=True):
            if not api_key:
                st.error("Please enter a Gemini API Key first.")
            else:
                with st.spinner("Testing connection to Gemini API..."):
                    test_res = gemini_generate(
                        prompt="ping",
                        api_key=api_key,
                        model=model_name,
                        delay_sec=0.0
                    )
                    if test_res.get("status") == "ok":
                        st.success(f"✅ Connected to `{test_res.get('model', model_name)}` successfully!")
                    else:
                        st.error(f"❌ Connection error: {test_res.get('error')}")

        st.subheader("🛡️ Free-Tier Safety")
        delay_sec = st.slider(
            "Pacing Delay (seconds)",
            min_value=1.0,
            max_value=15.0,
            value=6.0,
            step=0.5,
            help="Delay between sequential queries to stay comfortably within free-tier rate limits (15 RPM)."
        )

        # Token & Limit Counter Widget
        st.divider()
        st.subheader("⚡ Token & Quota Counter")
        
        rate_metrics = get_rate_limit_metrics()
        session_calls_count = get_session_calls_count()

        st.markdown(f"""
        <div class="token-box">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Gemini calls this session:</span>
                <span style="font-weight:700; color:#F59E0B;">{session_calls_count} calls</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Total Session Tokens:</span>
                <span style="font-weight:700; color:#38BDF8;">{rate_metrics['total_tokens']:,}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Input / Output:</span>
                <span style="font-size:0.85rem;">{rate_metrics['total_prompt_tokens']:,} / {rate_metrics['total_candidates_tokens']:,}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span style="font-size:0.85rem; color:#94A3B8;">Est. Cost (Free Tier):</span>
                <span style="font-size:0.85rem; color:#4ADE80; font-weight:600;">${rate_metrics['est_cost_usd']:.4f}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

        rpm_val = rate_metrics['rpm']
        rpm_pct = rate_metrics['rpm_pct']
        rpm_color = "🟢 Safe" if rpm_val <= 8 else ("🟡 Moderate" if rpm_val <= 12 else "🔴 Near Limit")
        
        st.caption(f"**Live Request Rate:** {rpm_val} / 15 RPM ({rpm_color})")
        st.progress(rpm_pct / 100.0)

        rpd_val = rate_metrics['rpd']
        st.caption(f"**Daily Quota Usage:** {rpd_val} / 1,500 RPD")

        if st.button("🔄 Reset Token & Call Counters", use_container_width=True):
            reset_token_tracker()
            st.rerun()

        # Campaign History Selector
        st.divider()
        st.subheader("📂 Campaign History")

        campaign_groups = scan_all_campaign_runs(RUNS_DIR)
        
        if campaign_groups:
            camp_options = ["-- Select a campaign --"] + list(campaign_groups.keys())
            chosen_camp = st.selectbox(
                "Campaign History",
                options=camp_options,
                format_func=lambda cid: f"📁 {cid} ({len(campaign_groups[cid])} runs)" if cid != "-- Select a campaign --" else cid
            )

            if chosen_camp != "-- Select a campaign --":
                camp_runs = campaign_groups[chosen_camp]
                run_choices = []
                for idx, cr in enumerate(camp_runs):
                    is_latest = (idx == len(camp_runs) - 1)
                    date_label = str(cr.get("created", ""))[:16].replace("T", " ")
                    label = f"Run #{idx+1} — {date_label} {'(Latest 🌟)' if is_latest else ''}"
                    run_choices.append((label, cr))

                selected_run_label = st.selectbox(
                    "Select Run in Campaign",
                    options=[rc[0] for rc in run_choices],
                    index=len(run_choices) - 1
                )
                chosen_run_dict = next(rc[1] for rc in run_choices if rc[0] == selected_run_label)

                if st.button("📥 Load Selected Campaign Run", use_container_width=True):
                    st.session_state["run"] = chosen_run_dict["data"]
                    st.session_state["run_source_file"] = chosen_run_dict["filepath"]
                    st.session_state["current_campaign_id"] = chosen_camp
                    
                    cache_path = get_page_cache_path(st.session_state["run"], chosen_run_dict["filepath"])
                    cached_pages_df = load_cached_pages(cache_path)
                    if not cached_pages_df.empty:
                        st.session_state["pages_df"] = cached_pages_df
                    else:
                        st.session_state.pop("pages_df", None)

                    brand_cache_path = get_brand_cache_path(st.session_state["run"], chosen_run_dict["filepath"])
                    cached_brands = load_cached_brands(brand_cache_path)
                    if cached_brands:
                        st.session_state["brand_results"] = cached_brands
                    else:
                        st.session_state.pop("brand_results", None)

                    brief_cache_path = get_brief_cache_path(st.session_state["run"], chosen_run_dict["filepath"])
                    cached_brief = load_cached_brief(brief_cache_path)
                    if cached_brief:
                        st.session_state["content_brief"] = cached_brief
                    else:
                        st.session_state.pop("content_brief", None)

                    pitches_cache_path = get_pitches_cache_path(st.session_state["run"], chosen_run_dict["filepath"])
                    cached_pitches = load_cached_pitches(pitches_cache_path)
                    if cached_pitches:
                        st.session_state["outreach_pitches"] = list(cached_pitches.values())
                    else:
                        st.session_state.pop("outreach_pitches", None)

                    st.success(f"Loaded campaign run: {os.path.basename(chosen_run_dict['filepath'])}")
                    st.rerun()

        # Custom upload
        uploaded_run = st.file_uploader("Upload Custom Run (.json)", type=["json"])
        if uploaded_run:
            try:
                st.session_state["run"] = json.load(uploaded_run)
                st.session_state["run_source_file"] = uploaded_run.name
                st.session_state["current_campaign_id"] = st.session_state["run"].get("campaign_id", "custom-upload")
                
                cache_path = get_page_cache_path(st.session_state["run"], uploaded_run.name)
                cached_pages_df = load_cached_pages(cache_path)
                if not cached_pages_df.empty:
                    st.session_state["pages_df"] = cached_pages_df
                else:
                    st.session_state.pop("pages_df", None)

                brand_cache_path = get_brand_cache_path(st.session_state["run"], uploaded_run.name)
                cached_brands = load_cached_brands(brand_cache_path)
                if cached_brands:
                    st.session_state["brand_results"] = cached_brands
                else:
                    st.session_state.pop("brand_results", None)

                brief_cache_path = get_brief_cache_path(st.session_state["run"], uploaded_run.name)
                cached_brief = load_cached_brief(brief_cache_path)
                if cached_brief:
                    st.session_state["content_brief"] = cached_brief
                else:
                    st.session_state.pop("content_brief", None)

                pitches_cache_path = get_pitches_cache_path(st.session_state["run"], uploaded_run.name)
                cached_pitches = load_cached_pitches(pitches_cache_path)
                if cached_pitches:
                    st.session_state["outreach_pitches"] = list(cached_pitches.values())
                else:
                    st.session_state.pop("outreach_pitches", None)

                st.success("Uploaded run loaded successfully!")
            except Exception as e:
                st.error(f"Invalid JSON file: {e}")

    # ------------------------------------------------------------------------
    # Step 0: Free Google Gemini API Key (BYOK) - Prominent Main View
    # ------------------------------------------------------------------------
    if "gemini_api_key" not in st.session_state:
        st.session_state["gemini_api_key"] = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()

    # Sync with sidebar value if provided
    if api_key and api_key.strip() != st.session_state["gemini_api_key"]:
        st.session_state["gemini_api_key"] = api_key.strip()

    active_api_key = st.session_state.get("gemini_api_key", "").strip()
    effective_key = (active_api_key or api_key or os.getenv("GEMINI_API_KEY", "")).strip()

    st.markdown("""
    <div style="background: linear-gradient(135deg, rgba(27, 100, 181, 0.12) 0%, rgba(104, 184, 46, 0.10) 100%); border: 1px solid rgba(27, 100, 181, 0.35); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
            <div>
                <span style="background: rgba(104, 184, 46, 0.2); color: #68B82E; border: 1px solid rgba(104, 184, 46, 0.4); padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                    100% FREE TO USE · ZERO BILLING · NO CARD REQUIRED
                </span>
                <h3 style="margin: 8px 0 2px 0; color: #E9ECF2; font-size: 20px; font-weight: 700;">
                    🔑 Step 0: Enter Your Free Google Gemini API Key
                </h3>
                <p style="margin: 0; color: #94A3B8; font-size: 13px;">
                    This tool runs queries directly on your Google AI Studio free quota. Your key is stored securely in this browser session only.
                </p>
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" style="background: #1B64B5; color: #FFFFFF; padding: 9px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(27,100,181,0.35);">
                Get Free API Key in 30s ↗
            </a>
        </div>
    </div>
    """, unsafe_allow_html=True)

    key_col1, key_col2 = st.columns([3, 1])
    with key_col1:
        main_key_input = st.text_input(
            "Enter Google Gemini API Key",
            value=active_api_key,
            type="password",
            placeholder="AIzaSy... (Paste your free key here)",
            help="Get your free key at https://aistudio.google.com/app/apikey"
        )
        if main_key_input.strip() != active_api_key:
            st.session_state["gemini_api_key"] = main_key_input.strip()
            active_api_key = main_key_input.strip()
            api_key = main_key_input.strip()
            effective_key = main_key_input.strip()

    with key_col2:
        st.write("")
        st.write("")
        if st.button("🧪 Verify Key", use_container_width=True):
            if not effective_key:
                st.error("Please enter a key first.")
            else:
                with st.spinner("Connecting to Gemini..."):
                    t_res = gemini_generate(prompt="ping", api_key=effective_key, model=model_name, delay_sec=0.0)
                    if t_res.get("status") == "ok":
                        st.success(f"✅ Active & Verified! ({t_res.get('model', model_name)})")
                    else:
                        st.error(f"❌ Error: {t_res.get('error')}")

    if effective_key:
        api_key = effective_key
        st.markdown(
            '<div style="margin-bottom: 20px; font-size: 12px; color: #4ADE80; font-weight: 600;">'
            '✅ Google Gemini API Key is Active · Ready to Prospect Citations'
            '</div>',
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            '<div style="margin-bottom: 20px; font-size: 12px; color: #F59E0B; font-weight: 600;">'
            '👉 Paste your free Gemini API Key above to unlock prompt generation and citation prospecting.'
            '</div>',
            unsafe_allow_html=True
        )

    # ------------------------------------------------------------------------
    # Campaign Inputs (Supports Multi-Market Mode)
    # ------------------------------------------------------------------------
    st.subheader("1. Business & Campaign Profile")
    col1, col2 = st.columns(2)

    with col1:
        client_name = st.text_input("Your Business / Client Name", value="Digital4Local", help="Brand name to analyze for AI recommendations.")
        client_domain = st.text_input("Your Business Domain", value="digital4local.com", help="Root domain of your website.")
        service = st.text_input("Service / Niche (Plural)", value="AI growth and local SEO agencies", help="Target industry niche.")
        location_input = st.text_input(
            "Markets / Locations (e.g. 'the UK' or 'the UK, the US, Australia' for Multi-Market)",
            value="the UK, the US",
            help="Target geographic regions."
        )
        markets_list = [m.strip() for m in location_input.split(",") if m.strip()] or ["the UK"]

    with col2:
        comp_text = st.text_area(
            "Competitors to Audit (one per line: Brand | domain)",
            value="FatJoe | fatjoe.com\nSiege Media | siegemedia.com\nPage One Power | pageonepower.com",
            height=135,
            placeholder="FatJoe | fatjoe.com\nSiege Media | siegemedia.com"
        )
        inv_file = st.file_uploader(
            "Publisher Inventory CSV (Optional — 'domain' column or first column)",
            type=["csv"],
            help="Domains you already have existing relationships with or have in inventory."
        )

    # Process Inventory CSV
    inventory = set()
    if inv_file:
        try:
            df_inv = pd.read_csv(inv_file)
            col_name = "domain" if "domain" in df_inv.columns else df_inv.columns[0]
            inventory = {root_domain(str(x)) for x in df_inv[col_name].dropna()}
            st.info(f"Loaded **{len(inventory)}** publisher inventory domains for direct matching.")
        except Exception as e:
            st.warning(f"Could not parse inventory CSV: {e}")

    # ------------------------------------------------------------------------
    # Prompt Generation & Settings
    # ------------------------------------------------------------------------
    st.subheader("2. Buyer-Intent Prompts")
    pcol1, pcol2 = st.columns([1, 1])

    with pcol1:
        num_prompts = st.slider("Number of Prompts per Market", min_value=3, max_value=25, value=5)
    with pcol2:
        repeats = st.slider(
            "Repeats per Prompt (Consistency Test)",
            min_value=1,
            max_value=3,
            value=1,
            help="Running queries multiple times uncovers true citation consistency %."
        )

    gen_col1, gen_col2 = st.columns([1, 3])
    with gen_col1:
        if st.button("✨ Generate Prompts", use_container_width=True):
            if not effective_key:
                st.warning("⚠️ No API key found. Generating fallback template prompts.")
            with st.spinner("Asking Gemini to generate high-intent buyer questions..."):
                generated = generate_prompts_gemini(
                    service=service,
                    location=markets_list[0],
                    n=num_prompts,
                    api_key=effective_key,
                    model=model_name,
                    delay_sec=delay_sec
                )
                st.session_state["prompts_text"] = "\n".join(generated)

    default_prompts = st.session_state.get(
        "prompts_text",
        "\n".join([t.format(s=service, loc=markets_list[0]) for t in TEMPLATES[:num_prompts]])
    )
    prompts_input = st.text_area(
        "Prompts (one per line — editable)",
        value=default_prompts,
        height=160
    )
    prompts_list = [p.strip() for p in prompts_input.splitlines() if p.strip()]

    if len(markets_list) > 1:
        st.info(f"🌍 **Multi-Market Mode Active:** Will run `{len(prompts_list)}` prompts across **{len(markets_list)} markets** ({', '.join(markets_list)}) for a total of **{len(prompts_list) * len(markets_list) * repeats}** queries.")

    # ------------------------------------------------------------------------
    # Execution Button
    # ------------------------------------------------------------------------
    st.write("")
    run_btn = st.button(
        "🚀 Run Gemini Citation Prospector",
        type="primary",
        disabled=not prompts_list,
        use_container_width=True
    )

    if not effective_key:
        st.info("💡 Please paste your Free Google Gemini API Key in Step 0 above to start the live audit.")

    if run_btn:
        if not effective_key:
            st.error("⚠️ Please enter your Free Google Gemini API Key in Step 0 above before running the audit.")
            st.stop()

        progress_bar = st.progress(0.0)
        status_text = st.empty()

        competitors_list = parse_competitors(comp_text)
        records = run_grounded_campaign_multi_market(
            prompts=prompts_list,
            markets=markets_list,
            repeats=repeats,
            api_key=effective_key,
            model=model_name,
            delay_sec=delay_sec,
            progress_bar=progress_bar,
            status_text=status_text
        )

        run_total_tokens = sum(r.get("total_tokens", 0) for r in records)
        run_prompt_tokens = sum(r.get("prompt_tokens", 0) for r in records)
        run_cand_tokens = sum(r.get("candidates_tokens", 0) for r in records)

        campaign_id = get_campaign_id(client_name, service, ", ".join(markets_list))

        run_payload = {
            "campaign_id": campaign_id,
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "client": {"name": client_name, "domain": client_domain},
            "service": service,
            "location": location_input,
            "markets": markets_list,
            "competitors": competitors_list,
            "prompts": prompts_list,
            "repeats": repeats,
            "model": model_name,
            "total_tokens": run_total_tokens,
            "total_prompt_tokens": run_prompt_tokens,
            "total_candidates_tokens": run_cand_tokens,
            "records": records,
        }

        saved_path = save_run(run_payload)
        st.session_state["run"] = run_payload
        st.session_state["run_source_file"] = saved_path
        st.session_state["current_campaign_id"] = campaign_id
        st.session_state.pop("pages_df", None)
        st.session_state.pop("brand_results", None)
        st.session_state.pop("content_brief", None)
        st.session_state.pop("outreach_pitches", None)
        st.success(f"🎉 Run complete! Saved results to `{saved_path}` for campaign `{campaign_id}`")

    # ------------------------------------------------------------------------
    # Analysis & Results Dashboard
    # ------------------------------------------------------------------------
    current_run = st.session_state.get("run")
    if not current_run:
        return

    records = current_run.get("records", [])
    if not records:
        st.warning("No records found in current run.")
        return

    client_dict = current_run.get("client", {})
    comp_list = current_run.get("competitors", [])
    rep_count = current_run.get("repeats", 1)
    run_markets = current_run.get("markets", [current_run.get("location", "the UK")])
    if isinstance(run_markets, str):
        run_markets = [m.strip() for m in run_markets.split(",") if m.strip()]

    campaign_id = current_run.get("campaign_id") or get_campaign_id(
        client_dict.get("name", ""),
        current_run.get("service", ""),
        ", ".join(run_markets)
    )

    table, sov_df = analyse(records, client_dict, comp_list, inventory, repeats=rep_count)
    errors = [r for r in records if r.get("error")]

    # Collect all unique URLs cited across this run
    all_cited_urls = []
    for r in records:
        for u in r.get("urls", []):
            if u:
                all_cited_urls.append(u)
    unique_cited_urls = list(dict.fromkeys([clean_url(u) for u in all_cited_urls if u]))

    # Load matching caches
    run_source = st.session_state.get("run_source_file", "")
    page_cache_path = get_page_cache_path(current_run, run_source)
    if "pages_df" not in st.session_state or st.session_state["pages_df"].empty:
        cached_df = load_cached_pages(page_cache_path)
        if not cached_df.empty:
            st.session_state["pages_df"] = cached_df

    pages_df = st.session_state.get("pages_df", pd.DataFrame())

    brand_cache_path = get_brand_cache_path(current_run, run_source)
    if "brand_results" not in st.session_state or not st.session_state["brand_results"]:
        cached_b = load_cached_brands(brand_cache_path)
        if cached_b:
            st.session_state["brand_results"] = cached_b

    brand_results = st.session_state.get("brand_results", [])
    brand_summary_df = calculate_brand_position_summary(brand_results, client_dict, comp_list) if brand_results else pd.DataFrame()

    brief_cache_path = get_brief_cache_path(current_run, run_source)
    if "content_brief" not in st.session_state or not st.session_state["content_brief"]:
        cached_brief = load_cached_brief(brief_cache_path)
        if cached_brief:
            st.session_state["content_brief"] = cached_brief

    content_brief_data = st.session_state.get("content_brief", {})

    pitches_cache_path = get_pitches_cache_path(current_run, run_source)
    if "outreach_pitches" not in st.session_state or not st.session_state["outreach_pitches"]:
        cached_pitches = load_cached_pitches(pitches_cache_path)
        if cached_pitches:
            st.session_state["outreach_pitches"] = list(cached_pitches.values())

    if not pages_df.empty:
        table = merge_page_analysis_into_domains(table, pages_df)

    st.divider()
    st.subheader(f"📊 Campaign: `{campaign_id}` — {current_run.get('service', 'Niche')} ({', '.join(run_markets)})")

    # Top 6 Metrics Row
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    total_successful_answers = len(records) - len(errors)
    unique_domains = len(table) if not table.empty else 0
    outreach_targets = int(table["action"].str.startswith("Outreach").sum()) if not table.empty else 0
    
    client_sov = "0%"
    if not sov_df.empty and client_dict.get("name"):
        client_row = sov_df[sov_df["brand"].str.lower() == client_dict["name"].strip().lower()]
        if not client_row.empty:
            client_sov = f"{client_row['share_of_voice_pct'].iloc[0]}%"

    client_avg_pos = "Not listed"
    if not brand_summary_df.empty and client_dict.get("name"):
        c_brand_row = brand_summary_df[brand_summary_df["brand"].str.lower() == client_dict["name"].strip().lower()]
        if not c_brand_row.empty:
            pos_val = c_brand_row["avg_position_display"].iloc[0]
            client_avg_pos = pos_val if pos_val != "-" else "Not listed"

    # Average Citation-Worthiness Score for top 20 pages
    avg_top20_score_str = "N/A"
    if not pages_df.empty and "citation_worthiness_score" in pages_df.columns:
        top20_pages = pages_df.sort_values(by="citation_worthiness_score", ascending=False).head(20)
        if not top20_pages.empty:
            avg_top20_score = int(top20_pages["citation_worthiness_score"].mean())
            avg_top20_score_str = f"{avg_top20_score}/100"

    with m1:
        st.metric("Total Answers", total_successful_answers, help="Total AI grounded answers collected")
    with m2:
        st.metric("Unique Domains", unique_domains, help="Total distinct root domains referenced")
    with m3:
        st.metric("Outreach Targets", outreach_targets, help="Non-competitor, non-directory target domains")
    with m4:
        st.metric("Client Share of Voice", client_sov, help="% of answers mentioning client brand")
    with m5:
        st.metric("Client Avg Position", client_avg_pos, help="Average ranking position in AI recommendations (1.0 = top pick)")
    with m6:
        st.metric("Avg Citation Score", avg_top20_score_str, help="Mean Citation-Worthiness Score for top 20 cited pages (0-100)")

    # ------------------------------------------------------------------------
    # Intelligence Action Cards (On-Page, Brand Position, Content Brief)
    # ------------------------------------------------------------------------
    act_col1, act_col2, act_col3 = st.columns(3)

    with act_col1:
        st.markdown("""
        <div class="action-card analyse-card">
            <h4 style="margin-top:0px; margin-bottom:4px; color:#10B981;">🔍 1. Deep On-Page Analysis</h4>
            <p style="margin-bottom:10px; font-size:0.86rem; color:#475569;">
                Scrapes pages, finds <strong>Competitor Gaps</strong>, contacts, dates, and computes <strong>0-100 Citation-Worthiness Scores</strong>.
            </p>
        </div>
        """, unsafe_allow_html=True)
        
        analyse_btn_label = "🔍 Analyse Cited Pages" if pages_df.empty else "🔄 Re-analyse Cited Pages"
        if st.button(analyse_btn_label, use_container_width=True):
            if not unique_cited_urls:
                st.warning("No URLs found to analyze.")
            else:
                page_bar = st.progress(0.0)
                page_status = st.empty()

                analysed_pages = analyse_all_cited_pages(
                    urls=unique_cited_urls,
                    root_domain_fn=root_domain,
                    clean_url_fn=clean_url,
                    mentions_fn=mentions,
                    client=client_dict,
                    competitors=comp_list,
                    directory_domains=DIRECTORY_DOMAINS,
                    ugc_domains=UGC_DOMAINS,
                    progress_callback=lambda p, msg: (page_bar.progress(p), page_status.text(msg))
                )

                save_cached_pages(analysed_pages, page_cache_path)
                st.session_state["pages_df"] = analysed_pages
                st.success(f"🎉 Analyzed {len(analysed_pages)} pages! Found {int(analysed_pages['competitor_gap'].sum())} competitor gap pages.")
                st.rerun()

        if not pages_df.empty:
            gaps_found = int(pages_df["competitor_gap"].sum())
            contacts_found = int((pages_df["contact"] != "").sum())
            st.caption(f"✅ `{len(pages_df)}` pages | ⚔️ `{gaps_found}` gaps | 📧 `{contacts_found}` contacts")

    with act_col2:
        st.markdown("""
        <div class="action-card brand-card">
            <h4 style="margin-top:0px; margin-bottom:4px; color:#F59E0B;">👑 2. Brand Position & Sentiment</h4>
            <p style="margin-bottom:10px; font-size:0.86rem; color:#475569;">
                Evaluates exact recommendation rank position (#1, #2, #3) and sentiment hierarchy across answers.
            </p>
        </div>
        """, unsafe_allow_html=True)

        brand_btn_label = "🧠 Analyze Brand Positions" if not brand_results else "🔄 Re-analyze Brand Positions"
        if st.button(brand_btn_label, use_container_width=True):
            brand_bar = st.progress(0.0)
            brand_status = st.empty()

            new_brand_results = analyze_all_records_brands(
                records=records,
                client_dict=client_dict,
                competitors=comp_list,
                api_key=api_key,
                model=model_name,
                delay_sec=delay_sec,
                progress_callback=lambda p, msg: (brand_bar.progress(p), brand_status.text(msg))
            )

            save_cached_brands(new_brand_results, brand_cache_path)
            st.session_state["brand_results"] = new_brand_results
            st.success("🎉 Brand position and sentiment analysis completed!")
            st.rerun()

        if brand_results:
            st.caption(f"✅ Evaluated `{len(brand_results)}` answers across `{len(brand_summary_df)}` brands.")

    with act_col3:
        st.markdown("""
        <div class="action-card brief-card">
            <h4 style="margin-top:0px; margin-bottom:4px; color:#6366F1;">📝 3. AI Content Brief</h4>
            <p style="margin-bottom:10px; font-size:0.86rem; color:#475569;">
                Synthesizes top 10 cited pages into winning angles, structure outline, and <strong>5 Linkable-Asset Ideas</strong>.
            </p>
        </div>
        """, unsafe_allow_html=True)

        brief_btn_label = "📝 Build Content Brief" if not content_brief_data else "🔄 Re-build Content Brief"
        if st.button(brief_btn_label, use_container_width=True):
            top_pages_for_brief = pages_df.to_dict(orient="records") if not pages_df.empty else []
            with st.spinner("Synthesizing content brief and 5 linkable-asset ideas with Gemini..."):
                brief_res = generate_content_brief(
                    top_pages=top_pages_for_brief,
                    client_dict=client_dict,
                    service=current_run.get("service", service),
                    market=run_markets[0],
                    api_key=api_key,
                    model=model_name,
                    delay_sec=delay_sec
                )
                save_cached_brief(brief_res, brief_cache_path)
                st.session_state["content_brief"] = brief_res
                st.success("🎉 Generated editorial content brief & 5 linkable asset ideas!")
                st.rerun()

        if content_brief_data:
            st.caption(f"✅ Content brief built with `{len(content_brief_data.get('content_ideas', []))}` linkable asset ideas.")

    # ------------------------------------------------------------------------
    # Executive Client Report Export Section (Excel & HTML)
    # ------------------------------------------------------------------------
    st.markdown("""
    <div class="export-banner">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4 style="margin:0px 0px 4px 0px; color:#38BDF8;">📥 White-Label Client Report Deliverables</h4>
                <p style="margin:0px; font-size:0.88rem; color:#94A3B8;">
                    Download boardroom-ready deliverables including multi-sheet Excel (.xlsx) and executive HTML (.html) reports with your custom agency branding.
                </p>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    gap_pages_for_export = pages_df[pages_df["competitor_gap"] == True].copy() if not pages_df.empty and "competitor_gap" in pages_df.columns else pd.DataFrame()

    rcol1, rcol2, rcol3 = st.columns([1, 1, 2])
    with rcol1:
        excel_bytes = export_excel_report(
            run_payload=current_run,
            table_df=table,
            gap_pages_df=gap_pages_for_export,
            brand_summary_df=brand_summary_df,
            pitches_list=st.session_state.get("outreach_pitches", []),
            content_brief_data=content_brief_data,
            agency_name=agency_name
        )
        st.download_button(
            label="📊 Download Excel Report (.xlsx)",
            data=excel_bytes,
            file_name=f"ai_citation_report_{campaign_id}_{datetime.datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
            use_container_width=True
        )

    with rcol2:
        html_report_str = generate_html_report(
            run_payload=current_run,
            table_df=table,
            gap_pages_df=gap_pages_for_export,
            brand_summary_df=brand_summary_df,
            content_brief_data=content_brief_data,
            agency_name=agency_name
        )
        st.download_button(
            label="📄 Download HTML Report (.html)",
            data=html_report_str.encode("utf-8"),
            file_name=f"ai_citation_report_{campaign_id}_{datetime.datetime.now().strftime('%Y%m%d')}.html",
            mime="text/html",
            type="secondary",
            use_container_width=True
        )

    if errors:
        with st.expander(f"⚠️ {len(errors)} Queries Encountered Errors", expanded=True):
            st.error("Some queries encountered errors. Review details below:")
            err_df = pd.DataFrame(errors)[["prompt", "repeat", "error"]]
            st.dataframe(err_df, use_container_width=True)

    if table.empty:
        st.warning("No citations were returned by Gemini for these queries.")
        return

    # ------------------------------------------------------------------------
    # All Detailed Result Tabs (9 Tabs)
    # ------------------------------------------------------------------------
    tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9 = st.tabs([
        "🎯 Link Targets",
        "⚔️ Competitor Gaps",
        "👑 Brand Position",
        "📑 Content Brief",
        "📈 Trend",
        "🌍 Markets",
        "📢 Share of Voice",
        "📝 Raw Answers & Citations",
        "⚡ Token & Quota Monitor"
    ])

    # ------------------------------------------------------------------------
    # Tab 1: Link Targets
    # ------------------------------------------------------------------------
    with tab1:
        st.markdown("### Prioritised Link Targets & Outreach List")
        st.caption("Domains cited by Gemini with Citation-Worthiness Scores (0-100). Select up to 10 targets to write pitches.")
        
        fcol1, fcol2, fcol3 = st.columns([2, 2, 2])
        with fcol1:
            all_actions = sorted(table["action"].unique())
            selected_actions = st.multiselect("Filter by Action Category", options=all_actions, default=all_actions)
        with fcol2:
            all_pitch_types = sorted(table["best_pitch_type"].unique()) if "best_pitch_type" in table.columns else ["List inclusion", "Directory listing", "Guest post", "Niche edit", "Community / UGC"]
            selected_pitch = st.multiselect("Filter by Pitch Type", options=all_pitch_types, default=all_pitch_types)
        with fcol3:
            search_query = st.text_input("Search Domain, Contact, or URL", placeholder="e.g. clutch, editor@..., tech...")

        filtered_table = table[table["action"].isin(selected_actions)].copy()
        if "best_pitch_type" in filtered_table.columns and selected_pitch:
            filtered_table = filtered_table[filtered_table["best_pitch_type"].isin(selected_pitch)]

        if search_query:
            filtered_table = filtered_table[
                filtered_table["domain"].str.contains(search_query, case=False, na=False) |
                filtered_table["top_urls"].str.contains(search_query, case=False, na=False) |
                filtered_table["contact"].str.contains(search_query, case=False, na=False)
            ]

        display_editor_df = filtered_table.copy()
        display_editor_df.insert(0, "Select", False)

        st.markdown("##### 📌 Select Targets to Pitch (Max 10):")
        edited_targets = st.data_editor(
            display_editor_df,
            hide_index=True,
            use_container_width=True,
            column_config={
                "Select": st.column_config.CheckboxColumn("Select", help="Check to write pitch for this target", default=False),
                "domain": st.column_config.TextColumn("Root Domain", width="medium"),
                "priority_score": st.column_config.NumberColumn("Priority Score", format="%.1f", help="Base citations + prompts + competitor gaps (+5 per gap page)"),
                "citation_worthiness_score": st.column_config.NumberColumn("Citation Score (0-100)", help="Freshness, statistics, schema, depth, author score"),
                "citations": st.column_config.NumberColumn("Citations"),
                "prompts_cited_in": st.column_config.NumberColumn("Prompts"),
                "competitor_gap_pages": st.column_config.NumberColumn("Gap Pages"),
                "best_pitch_type": st.column_config.TextColumn("Pitch Strategy", width="medium"),
                "contact": st.column_config.TextColumn("Contact / Email", width="medium"),
                "guest_post_url": st.column_config.LinkColumn("Guest Post URL", width="medium"),
                "newest_last_updated": st.column_config.TextColumn("Last Updated"),
                "action": st.column_config.TextColumn("Action Category", width="medium"),
                "top_urls": st.column_config.TextColumn("Top Cited URLs", width="large"),
            },
            disabled=[c for c in display_editor_df.columns if c != "Select"]
        )

        selected_target_rows = edited_targets[edited_targets["Select"] == True].to_dict(orient="records")
        num_selected = len(selected_target_rows)

        btn_col1, btn_col2 = st.columns([1, 2])
        with btn_col1:
            write_pitch_btn = st.button(
                f"✍️ Write Pitches ({num_selected}/10 selected)",
                type="primary",
                disabled=(num_selected == 0 or num_selected > 10)
            )

        if num_selected > 10:
            st.warning("⚠️ Please select at most 10 targets at a time to stay within recommended batch limits.")

        if write_pitch_btn and selected_target_rows:
            pitch_bar = st.progress(0.0)
            pitch_status = st.empty()

            generated_pitches = generate_batch_pitches(
                selected_rows=selected_target_rows,
                client_dict=client_dict,
                service=current_run.get("service", service),
                market=run_markets[0] if run_markets else "",
                api_key=api_key,
                model=model_name,
                delay_sec=delay_sec,
                progress_callback=lambda p, msg: (pitch_bar.progress(p), pitch_status.text(msg))
            )
            
            pitches_dict = {p.get("url", f"target_{i}"): p for i, p in enumerate(generated_pitches)}
            existing_pitches = load_cached_pitches(pitches_cache_path)
            existing_pitches.update(pitches_dict)
            save_cached_pitches(existing_pitches, pitches_cache_path)
            st.session_state["outreach_pitches"] = list(existing_pitches.values())
            st.success(f"🎉 Successfully drafted {len(generated_pitches)} personalized outreach pitches!")
            st.rerun()

        current_pitches = st.session_state.get("outreach_pitches", [])
        if current_pitches:
            st.divider()
            st.markdown("### ✉️ Generated Outreach Pitches")
            st.caption("Review, copy, or export personalized pitches below. *(Never auto-sent — manual review required)*")

            for p_idx, pitch in enumerate(current_pitches):
                domain_title = pitch.get("domain") or pitch.get("url", f"Target #{p_idx+1}")
                pitch_type_str = pitch.get("pitch_type", "Outreach")
                with st.expander(f"{domain_title} — {pitch_type_str}", expanded=(p_idx == 0)):
                    st.markdown(f"**Target URL:** [{pitch.get('url')}]({pitch.get('url')})")
                    if pitch.get("contact"):
                        st.markdown(f"**Contact:** `{pitch.get('contact')}`")
                    
                    st.markdown(f"**Subject:** `{pitch.get('subject', '')}`")
                    st.markdown("**Email:**")
                    st.code(pitch.get("email", ""), language="text")

                    if pitch.get("suggested_anchor"):
                        st.markdown(f"**Suggested Anchor:** `{pitch.get('suggested_anchor')}`")
                    if pitch.get("suggested_sentence"):
                        st.markdown(f"**Suggested Sentence:** *\"{pitch.get('suggested_sentence')}\"*")
                    
                    title_ideas = pitch.get("title_ideas") or pitch.get("suggested_topics") or []
                    if title_ideas and isinstance(title_ideas, list):
                        st.markdown("**Title Ideas:**")
                        for t in title_ideas:
                            st.markdown(f"- 💡 {t}")

            st.info("⚠️ Review every pitch before sending.")

            df_pitches = pitches_to_dataframe(current_pitches)
            pitch_csv = df_pitches.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="📥 Download Generated Pitches (CSV)",
                data=pitch_csv,
                file_name=f"outreach_pitches_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv",
                type="primary"
            )

        st.divider()
        csv_data = filtered_table.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Download All Link Targets CSV",
            data=csv_data,
            file_name=f"gemini_link_targets_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )

        st.markdown("#### Top 15 Most Prioritised Domains")
        top15 = table.head(15)
        st.bar_chart(
            data=top15.set_index("domain")["priority_score"],
            use_container_width=True
        )

    # ------------------------------------------------------------------------
    # Tab 2: Competitor Gaps
    # ------------------------------------------------------------------------
    with tab2:
        st.markdown("### ⚔️ Competitor Gap Opportunities")
        st.caption("Exact cited URLs where competitor brands are linked or named, but your client brand is omitted. Select up to 10 rows to draft pitches.")

        if pages_df.empty:
            st.info("💡 Click the **'🔍 Analyse Cited Pages'** button above to crawl cited URLs and extract competitor gap pages.")
        else:
            gap_pages = pages_df[pages_df["competitor_gap"] == True].copy()
            if gap_pages.empty:
                st.success("🎉 No competitor gaps detected — your brand is either mentioned across all competitor pages or no competitors were cited!")
            else:
                st.markdown(f"Found **{len(gap_pages)} high-intent competitor gap pages** ready for outreach pitching:")
                gap_pages["competitors_list"] = gap_pages["competitors_present"].apply(lambda lst: ", ".join(lst) if isinstance(lst, list) else str(lst))
                
                gap_editor_df = gap_pages.copy()
                gap_editor_df.insert(0, "Select", False)

                edited_gaps = st.data_editor(
                    gap_editor_df,
                    hide_index=True,
                    use_container_width=True,
                    column_config={
                        "Select": st.column_config.CheckboxColumn("Select", help="Check to write pitch for this gap page", default=False),
                        "url": st.column_config.LinkColumn("Page URL", width="large"),
                        "domain": st.column_config.TextColumn("Domain"),
                        "page_title": st.column_config.TextColumn("Page Title", width="large"),
                        "citation_worthiness_score": st.column_config.NumberColumn("Citation Score (0-100)"),
                        "competitors_list": st.column_config.TextColumn("Competitors Featured", width="medium"),
                        "pitch_type": st.column_config.TextColumn("Pitch Strategy"),
                        "contact": st.column_config.TextColumn("Outreach Contact", width="medium"),
                        "last_updated": st.column_config.TextColumn("Date Updated"),
                        "word_count": st.column_config.NumberColumn("Word Count"),
                        "sponsored_or_nofollow_share": st.column_config.NumberColumn("Nofollow %", format="%.1f%%"),
                        "fetch_status": st.column_config.TextColumn("Status")
                    },
                    disabled=[c for c in gap_editor_df.columns if c != "Select"]
                )

                selected_gap_rows = edited_gaps[edited_gaps["Select"] == True].to_dict(orient="records")
                num_gaps_selected = len(selected_gap_rows)

                g_col1, g_col2 = st.columns([1, 2])
                with g_col1:
                    write_gap_pitches_btn = st.button(
                        f"✍️ Write Pitches for Gaps ({num_gaps_selected}/10 selected)",
                        type="primary",
                        disabled=(num_gaps_selected == 0 or num_gaps_selected > 10),
                        key="write_gap_pitches_btn"
                    )

                if num_gaps_selected > 10:
                    st.warning("⚠️ Please select at most 10 gap targets at a time.")

                if write_gap_pitches_btn and selected_gap_rows:
                    gap_bar = st.progress(0.0)
                    gap_status = st.empty()

                    gap_pitches = generate_batch_pitches(
                        selected_rows=selected_gap_rows,
                        client_dict=client_dict,
                        service=current_run.get("service", service),
                        market=run_markets[0] if run_markets else "",
                        api_key=api_key,
                        model=model_name,
                        delay_sec=delay_sec,
                        progress_callback=lambda p, msg: (gap_bar.progress(p), gap_status.text(msg))
                    )
                    
                    pitches_dict = {p.get("url", f"gap_{i}"): p for i, p in enumerate(gap_pitches)}
                    existing_pitches = load_cached_pitches(pitches_cache_path)
                    existing_pitches.update(pitches_dict)
                    save_cached_pitches(existing_pitches, pitches_cache_path)
                    st.session_state["outreach_pitches"] = list(existing_pitches.values())
                    st.success(f"🎉 Generated {len(gap_pitches)} personalized pitches for competitor gap targets!")
                    st.rerun()

                gap_csv = gap_pages.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download Competitor Gaps CSV",
                    data=gap_csv,
                    file_name=f"competitor_gaps_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv"
                )

    # ------------------------------------------------------------------------
    # Tab 3: Brand Position & Sentiment
    # ------------------------------------------------------------------------
    with tab3:
        st.markdown("### 👑 AI Brand Position & Sentiment Analysis")
        st.caption(
            "Measures the exact ordinal position/ranking (1st, 2nd, 3rd) and sentiment assigned to your brand vs competitors in AI recommendation lists. "
            "*(Lower average position number = higher ranking position in Gemini recommendations)*."
        )

        if not brand_results or brand_summary_df.empty:
            st.info("💡 Click the **'🧠 Analyze Brand Positions'** button above to evaluate brand ranking hierarchy and sentiment across all Gemini answers.")
        else:
            st.markdown("#### 🏆 Brand Visibility & Recommendation Hierarchy")
            st.dataframe(
                brand_summary_df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "brand": st.column_config.TextColumn("Brand Name", width="medium"),
                    "role": st.column_config.TextColumn("Role", width="medium"),
                    "mentions": st.column_config.NumberColumn("Mentions", help="Number of answers mentioning brand"),
                    "mention_rate_pct": st.column_config.NumberColumn("Mention Rate", format="%.1f%%"),
                    "avg_position_display": st.column_config.TextColumn("Avg Position", help="Average rank position when mentioned (1.0 = #1 top pick)"),
                    "pct_top_3": st.column_config.NumberColumn("Top 3 Share %", format="%.1f%%", help="% of answers where brand was in top 3 recommendations"),
                    "pct_positive": st.column_config.NumberColumn("Positive %", format="%.1f%%"),
                    "pct_neutral": st.column_config.NumberColumn("Neutral %", format="%.1f%%"),
                    "pct_negative": st.column_config.NumberColumn("Negative %", format="%.1f%%"),
                    "dominant_sentiment": st.column_config.TextColumn("Overall Sentiment", width="medium")
                }
            )

            bcol1, bcol2 = st.columns(2)
            with bcol1:
                st.markdown("#### 📉 Average Recommendation Rank *(Lower = Better)*")
                chart_pos_df = brand_summary_df[brand_summary_df["avg_position"] < 90.0]
                if not chart_pos_df.empty:
                    st.bar_chart(
                        data=chart_pos_df.set_index("brand")["avg_position"],
                        use_container_width=True
                    )
                else:
                    st.caption("No brand rank positions to display.")

            with bcol2:
                st.markdown("#### 🎯 Share of Answers in Top 3 Positions (%)")
                st.bar_chart(
                    data=brand_summary_df.set_index("brand")["pct_top_3"],
                    use_container_width=True
                )

            with st.expander("🔍 Inspect Per-Answer Brand Position & Reason Breakdown"):
                st.markdown("Detailed breakdown of brand positions extracted for each prompt:")
                answer_rows = []
                for item in brand_results:
                    p_num = item.get("prompt_index", 0) + 1
                    rep = item.get("repeat", 1)
                    p_txt = item.get("prompt", "")
                    brands_list = item.get("brands", [])
                    
                    row_entry = {
                        "Prompt #": f"Q{p_num} (R{rep})",
                        "Question": p_txt[:50] + "..."
                    }
                    for b in brands_list:
                        b_name = b.get("name", "")
                        b_pos = b.get("position")
                        b_sent = b.get("sentiment", "neutral")
                        pos_str = f"#{b_pos}" if b_pos else "Not mentioned"
                        row_entry[b_name] = f"{pos_str} ({b_sent})"

                    answer_rows.append(row_entry)

                st.dataframe(pd.DataFrame(answer_rows), use_container_width=True, hide_index=True)

            brand_csv = brand_summary_df.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="📥 Download Brand Position Summary (CSV)",
                data=brand_csv,
                file_name=f"brand_positions_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv",
                type="primary"
            )

    # ------------------------------------------------------------------------
    # Tab 4: Content Brief (New Feature)
    # ------------------------------------------------------------------------
    with tab4:
        st.markdown("### 📑 AI Search Editorial Content Brief")
        st.caption("Synthesizes the common angles, questions answered, data benchmarks, and recommended formats from the top 10 AI-cited pages to engineer high-authority assets that earn citations.")

        if not content_brief_data:
            st.info("💡 Click the **'📝 Build Content Brief'** button above to analyze the top 10 AI-cited pages and synthesize an authority content plan.")
        else:
            # 1. Winning Angles & Questions Answered
            b_col1, b_col2 = st.columns(2)
            with b_col1:
                st.markdown("#### 🎯 Winning Narrative Angles")
                for a in content_brief_data.get("common_angles", []):
                    st.markdown(f"- {a}")

                st.markdown("#### 📊 Key Data Points & Benchmarks Used")
                for d in content_brief_data.get("data_points_used", []):
                    st.markdown(f"- 📈 {d}")

            with b_col2:
                st.markdown("#### ❓ Buyer Questions Answered")
                for q in content_brief_data.get("questions_answered", []):
                    st.markdown(f"- 💡 {q}")

                fmt = content_brief_data.get("recommended_format", {})
                if isinstance(fmt, dict):
                    st.markdown("#### 📐 Recommended Format & Structure")
                    st.markdown(f"**Format:** `{fmt.get('content_type', 'Benchmark Roundup')}`")
                    st.markdown(f"**Target Word Count:** `{fmt.get('recommended_word_count', '2,400 - 3,000 words')}`")
                    st.markdown(f"**Visual Assets:** {fmt.get('visual_assets', '')}")

            # 2. 5 Linkable Asset Ideas
            st.divider()
            st.markdown("#### 💡 5 High-Authority Linkable Asset & Guest Post Ideas (Engineered for AI Citations)")
            st.caption("Content pieces designed to answer buyer evaluation queries and earn direct citations from Google Gemini:")

            ideas = content_brief_data.get("content_ideas", [])
            for idx, idea in enumerate(ideas):
                with st.expander(f"💡 Asset #{idx+1}: {idea.get('title', '')} — [{idea.get('format', 'Data Study')}]", expanded=(idx==0)):
                    st.markdown(f"**Asset Format:** `{idea.get('format', 'Original Data Study')}`")
                    st.markdown(f"**Why AI Cites It:** {idea.get('why_ai_cites_it', '')}")
                    st.markdown(f"**Target Publisher Outreach Angle:** {idea.get('target_outreach_angle', '')}")

            brief_json_str = json.dumps(content_brief_data, indent=2)
            st.download_button(
                label="📥 Download Content Brief (JSON)",
                data=brief_json_str,
                file_name=f"content_brief_{campaign_id}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )

    # ------------------------------------------------------------------------
    # Tab 5: Trend & Run Comparison
    # ------------------------------------------------------------------------
    with tab5:
        st.markdown("### 📈 Campaign Trend & Run Comparison")
        st.caption("Compare citation dynamics across multiple runs in this campaign, monitor Brand SoV growth, detect domain churn, and verify Won Links now cited in AI answers.")

        campaign_groups = scan_all_campaign_runs(RUNS_DIR)
        curr_campaign_runs = campaign_groups.get(campaign_id, [])

        if len(curr_campaign_runs) < 2:
            st.info(f"💡 This campaign (`{campaign_id}`) currently has **{len(curr_campaign_runs)} run**. Run another iteration or select a campaign with multiple runs from the sidebar to view historical comparison trends.")
            demo_tcol1, demo_tcol2 = st.columns([1, 2])
            with demo_tcol1:
                if st.button("📥 Load Sample Trend Campaign (2 Runs)", use_container_width=True, type="secondary"):
                    with open("runs/sample_campaign_trend_2.json", "r", encoding="utf-8") as f:
                        st.session_state["run"] = json.load(f)
                    st.session_state["run_source_file"] = "runs/sample_campaign_trend_2.json"
                    st.session_state["current_campaign_id"] = "digital-web-solutions-link-building-agencies-the-uk"
                    cached_p = load_cached_pages("runs/pages_sample_campaign_trend_2.json")
                    if not cached_p.empty:
                        st.session_state["pages_df"] = cached_p
                    cached_b = load_cached_brands("runs/brands_sample_campaign_trend_2.json")
                    if cached_b:
                        st.session_state["brand_results"] = cached_b
                    cached_br = load_cached_brief("runs/brief_sample_campaign_trend_2.json")
                    if cached_br:
                        st.session_state["content_brief"] = cached_br
                    st.rerun()

        all_available_runs = scan_all_campaign_runs(RUNS_DIR)
        active_camp_runs = all_available_runs.get(campaign_id, curr_campaign_runs)

        if len(active_camp_runs) >= 2:
            tcol1, tcol2 = st.columns(2)
            with tcol1:
                earlier_options = [f"Run #{i+1} — {str(r['created'])[:16].replace('T', ' ')}" for i, r in enumerate(active_camp_runs[:-1])]
                selected_earlier_label = st.selectbox("Baseline Run (Earlier)", options=earlier_options, index=0)
                earlier_idx = earlier_options.index(selected_earlier_label)
                earlier_run_dict = active_camp_runs[earlier_idx]["data"]

            with tcol2:
                latest_options = [f"Run #{i+1} — {str(r['created'])[:16].replace('T', ' ')}" for i, r in enumerate(active_camp_runs)]
                selected_latest_label = st.selectbox("Current Run (Latest)", options=latest_options, index=len(latest_options)-1)
                latest_idx = latest_options.index(selected_latest_label)
                latest_run_dict = active_camp_runs[latest_idx]["data"]

            st.markdown("##### 🔗 'Won Links' Verification (Upload Built Links CSV):")
            wcol1, wcol2 = st.columns([2, 1])
            with wcol1:
                won_file = st.file_uploader("Upload Built Links CSV (column 'url')", type=["csv"], key="won_links_file_upload")
            with wcol2:
                load_sample_won = st.button("📥 Load Sample Built Links CSV (5 URLs)", use_container_width=True)

            won_urls = []
            if load_sample_won:
                try:
                    with open("runs/sample_won_links.csv", "r", encoding="utf-8") as f:
                        won_urls = parse_won_links_file(f)
                    st.session_state["won_urls_list"] = won_urls
                    st.info(f"Loaded **{len(won_urls)}** sample built links for verification.")
                except Exception:
                    pass
            elif won_file:
                won_urls = parse_won_links_file(won_file)
                st.session_state["won_urls_list"] = won_urls
            else:
                won_urls = st.session_state.get("won_urls_list", [])

            comp_results = compare_two_runs(earlier_run_dict, latest_run_dict, won_links_urls=won_urls)

            st.markdown(f"""
            <div class="trend-banner">
                <h4 style="margin-top:0px; margin-bottom:6px; color:#38BDF8;">📊 Campaign Trend Summary</h4>
                <p style="font-size:1.05rem; margin-bottom:0px; line-height:1.5;">
                    {comp_results['summary_sentence']}
                </p>
            </div>
            """, unsafe_allow_html=True)

            st.markdown("#### 📈 Brand Share of Voice (%) Over Time")
            sov_trend_series = compute_multi_run_sov_trend_series(active_camp_runs)
            if not sov_trend_series.empty:
                st.line_chart(sov_trend_series, use_container_width=True)

            st.markdown("#### 🔄 Cited Domain Movement (Churn Analysis)")
            ch1, ch2, ch3 = st.columns(3)
            with ch1:
                st.metric("🆕 New Domains Cited", len(comp_results["new_domains"]), help="Cited in current run but not in baseline run")
            with ch2:
                st.metric("🔻 Dropped Domains", len(comp_results["lost_domains"]), help="Cited in baseline run but dropped in current run")
            with ch3:
                st.metric("🔄 Stable / Retained Domains", len(comp_results["stable_domains"]), help="Consistently cited across both runs")

            with st.expander("📋 View Detailed Domain Churn Breakdown"):
                dcol1, dcol2 = st.columns(2)
                with dcol1:
                    st.markdown("**🆕 New Domains Cited in Latest Run:**")
                    if comp_results["new_domains"]:
                        st.dataframe(pd.DataFrame({"New Domain": comp_results["new_domains"]}), use_container_width=True, hide_index=True)
                    else:
                        st.caption("No new domains cited.")
                with dcol2:
                    st.markdown("**🔻 Dropped Domains from Earlier Run:**")
                    if comp_results["lost_domains"]:
                        st.dataframe(pd.DataFrame({"Dropped Domain": comp_results["lost_domains"]}), use_container_width=True, hide_index=True)
                    else:
                        st.caption("No dropped domains.")

            if not comp_results["won_links_analysis"].empty:
                st.markdown("#### 🎯 Won Links Attribution in AI Grounding Citations")
                st.caption("Verifies which URLs/domains where your team built links are now actively cited by Google Gemini answers.")
                st.dataframe(
                    comp_results["won_links_analysis"],
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "domain": st.column_config.TextColumn("Built Link Domain", width="medium"),
                        "won_url": st.column_config.LinkColumn("Built Link URL", width="large"),
                        "cited_in_latest": st.column_config.CheckboxColumn("Cited in Latest?", default=False),
                        "latest_citations": st.column_config.NumberColumn("Citations"),
                        "status": st.column_config.TextColumn("Attribution Status", width="medium")
                    }
                )

    # ------------------------------------------------------------------------
    # Tab 6: Multi-Market Mode
    # ------------------------------------------------------------------------
    with tab6:
        st.markdown("### 🌍 Multi-Market Citation Intelligence")
        st.caption("Compare how Google Gemini's AI grounding citations and recommendations vary across different geographic markets (UK, US, Australia, etc.).")

        multi_market_results = analyze_multi_market_run(records, client_dict, comp_list)
        all_markets_found = multi_market_results["all_markets"]

        if len(all_markets_found) <= 1:
            st.info("💡 Multi-Market mode requires running across 2 or more markets. Enter multiple markets (e.g. `the UK, the US, Australia`) in the Campaign Profile above to view cross-market matrices.")
            demo_mcol1, demo_mcol2 = st.columns([1, 2])
            with demo_mcol1:
                if st.button("📥 Load Sample Multi-Market Run (UK, US, AU)", use_container_width=True, type="secondary"):
                    with open("runs/sample_multi_market_run.json", "r", encoding="utf-8") as f:
                        st.session_state["run"] = json.load(f)
                    st.session_state["run_source_file"] = "runs/sample_multi_market_run.json"
                    st.session_state["current_campaign_id"] = "digital-web-solutions-link-building-agencies-uk-us-au"
                    cached_p = load_cached_pages("runs/pages_sample_multi_market_run.json")
                    if not cached_p.empty:
                        st.session_state["pages_df"] = cached_p
                    cached_b = load_cached_brands("runs/brands_sample_multi_market_run.json")
                    if cached_b:
                        st.session_state["brand_results"] = cached_b
                    cached_br = load_cached_brief("runs/brief_sample_multi_market_run.json")
                    if cached_br:
                        st.session_state["content_brief"] = cached_br
                    st.rerun()
        else:
            st.markdown("#### 🗺️ Domain × Market Citation Matrix")
            st.caption("Total times each domain was cited by Gemini across each geographic market:")
            
            heatmap_df = multi_market_results["heatmap_df"]
            if not heatmap_df.empty:
                st.dataframe(
                    heatmap_df,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "domain": st.column_config.TextColumn("Domain", width="medium"),
                        "Total Citations": st.column_config.NumberColumn("Total Citations"),
                        "Markets Cited In": st.column_config.NumberColumn("Markets Cited In")
                    }
                )

                matrix_csv = heatmap_df.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download Market Matrix CSV",
                    data=matrix_csv,
                    file_name=f"market_citation_matrix_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv"
                )

            st.markdown("#### 📢 Brand Share of Voice (%) Across Markets")
            m_sov_df = multi_market_results["market_sov_df"]
            if not m_sov_df.empty:
                st.dataframe(m_sov_df, use_container_width=True, hide_index=True)
                chart_m_sov = m_sov_df.set_index("Brand")
                st.bar_chart(chart_m_sov, use_container_width=True)

            st.divider()
            st.markdown("#### 🎯 Geo-Specific Targets vs Global Authority Domains")
            
            geo_col1, geo_col2 = st.columns(2)
            with geo_col1:
                st.markdown("##### 📍 Geo-Specific Targets (Cited in ONLY 1 Market)")
                st.caption("Ideal for local market outreach and targeted regional link acquisition:")
                single_df = multi_market_results["single_market_df"]
                if not single_df.empty:
                    st.dataframe(single_df, use_container_width=True, hide_index=True)
                else:
                    st.caption("No single-market domains found.")

            with geo_col2:
                st.markdown("##### 🌐 Global Multi-Market Authority Domains")
                st.caption("Dominant international publications cited across ALL tested markets:")
                global_df = multi_market_results["global_domains_df"]
                if not global_df.empty:
                    st.dataframe(global_df, use_container_width=True, hide_index=True)
                else:
                    st.caption("No multi-market global authorities found.")

    # ------------------------------------------------------------------------
    # Tab 7: Share of Voice
    # ------------------------------------------------------------------------
    with tab7:
        st.markdown("### Brand Share of Voice Comparison")
        st.caption("Percentage of valid Gemini answers that directly mention each brand.")
        
        if not sov_df.empty:
            st.dataframe(
                sov_df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "brand": st.column_config.TextColumn("Brand Name"),
                    "type": st.column_config.TextColumn("Role"),
                    "mentions": st.column_config.NumberColumn("Answer Mentions"),
                    "share_of_voice_pct": st.column_config.NumberColumn("Share of Voice %", format="%.1f%%"),
                }
            )
            st.bar_chart(
                data=sov_df.set_index("brand")["share_of_voice_pct"],
                use_container_width=True
            )
        else:
            st.info("No brand names provided to calculate Share of Voice.")

    # ------------------------------------------------------------------------
    # Tab 8: Raw Answers & Citations
    # ------------------------------------------------------------------------
    with tab8:
        st.markdown("### Full Gemini Answers & Grounding Citations")
        for i, r in enumerate(records):
            if r.get("error"):
                continue
            mkt_tag = f"[{r.get('market', 'Global')}] " if r.get('market') else ""
            with st.expander(f"{mkt_tag}Prompt {r['prompt_index'] + 1} (Run {r['repeat']}): {r['prompt']}"):
                st.markdown("**AI Response Text:**")
                st.markdown(r.get("answer", "*No text returned*"))
                
                cited_urls = r.get("urls", [])
                if cited_urls:
                    st.markdown("**Cited Sources & URLs:**")
                    for u in cited_urls:
                        st.markdown(f"- [{u}]({u})")
                else:
                    st.caption("No explicit source links extracted.")

    # ------------------------------------------------------------------------
    # Tab 9: Token & Quota Monitor
    # ------------------------------------------------------------------------
    with tab9:
        st.markdown("### ⚡ Gemini Token Consumption & Quota Monitor")
        st.caption("Detailed token usage breakdown, rate limit metrics, and free-tier quota analysis for this campaign.")

        valid_records = [r for r in records if not r.get("error")]
        run_p_tokens = sum(r.get("prompt_tokens", len(r.get("prompt", "")) // 4) for r in valid_records)
        run_c_tokens = sum(r.get("candidates_tokens", len(r.get("answer", "")) // 4) for r in valid_records)
        run_tot_tokens = run_p_tokens + run_c_tokens
        est_run_cost = (run_p_tokens * 0.075 / 1_000_000) + (run_c_tokens * 0.30 / 1_000_000)

        tc1, tc2, tc3, tc4 = st.columns(4)
        with tc1:
            st.metric("Total Tokens (Run)", f"{run_tot_tokens:,}", help="Total input + output tokens consumed in this run")
        with tc2:
            st.metric("Prompt (Input) Tokens", f"{run_p_tokens:,}", help="Tokens sent in queries and instructions")
        with tc3:
            st.metric("Candidate (Output) Tokens", f"{run_c_tokens:,}", help="Tokens generated in AI answers")
        with tc4:
            st.metric("Est. Cost (Free Tier: $0)", f"${est_run_cost:.4f}", help="Calculated using Flash Pay-As-You-Go pricing rates")

        st.divider()
        st.markdown("#### ⏱️ Rate Limits & Quota Health")
        
        gcol1, gcol2 = st.columns(2)
        with gcol1:
            rpm_curr = rate_metrics["rpm"]
            rpm_percent = rate_metrics["rpm_pct"]
            st.markdown(f"**Requests Per Minute (RPM):** `{rpm_curr} / 15 RPM Limit`")
            st.progress(rpm_percent / 100.0)
            if rpm_curr <= 8:
                st.success("🟢 **Status:** Pacing is optimal. You are well below the 15 RPM rate limit.")
            elif rpm_curr <= 12:
                st.warning("🟡 **Status:** Moderate rate. Consider increasing delay slightly.")
            else:
                st.error("🔴 **Status:** Near limit. Free-tier pacing delay prevents 429 errors.")

        with gcol2:
            rpd_curr = rate_metrics["rpd"]
            rpd_percent = rate_metrics["rpd_pct"]
            st.markdown(f"**Daily Request Quota (RPD):** `{rpd_curr} / 1,500 RPD Free Limit`")
            st.progress(rpd_percent / 100.0)
            st.info(f"💡 You have **{1500 - rpd_curr:,}** remaining requests available today on this key.")

        st.divider()
        st.markdown("#### 📋 Token Usage Breakdown per Query")

        token_rows = []
        for r in records:
            p_tok = r.get("prompt_tokens", len(r.get("prompt", "")) // 4)
            c_tok = r.get("candidates_tokens", len(r.get("answer", "")) // 4)
            tot_tok = r.get("total_tokens", p_tok + c_tok)
            lat = r.get("latency_sec", 1.2)
            mode_name = r.get("mode", "AI Citation")
            status = "✅ Success" if not r.get("error") else f"❌ {r.get('error')[:30]}..."
            
            token_rows.append({
                "Prompt #": r.get("prompt_index", 0) + 1,
                "Market": r.get("market", "Global"),
                "Repeat": r.get("repeat", 1),
                "Prompt Text": r.get("prompt", "")[:60] + ("..." if len(r.get("prompt", "")) > 60 else ""),
                "Input Tokens": p_tok,
                "Output Tokens": c_tok,
                "Total Tokens": tot_tok,
                "Latency (s)": f"{lat:.2f}s" if isinstance(lat, (int, float)) else str(lat),
                "Engine Mode": mode_name,
                "Status": status
            })

        df_tokens = pd.DataFrame(token_rows)
        st.dataframe(df_tokens, use_container_width=True, hide_index=True)

        token_csv = df_tokens.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Download Token Usage Breakdown (CSV)",
            data=token_csv,
            file_name=f"gemini_token_breakdown_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )


if __name__ == "__main__":
    main()
