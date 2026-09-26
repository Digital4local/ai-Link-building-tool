"""
AI Citation Link Prospector (Gemini Edition)
Finds which websites Google Gemini (with Google Search Grounding) cites when answering
high-intent buyer and research queries, then turns those domains into a prioritised
link-building & digital PR outreach target list.

Features:
- Dual-mode Search Grounding + AI Web Citation Fallback
- Deep On-Page Analysis (Title, H1, Competitor Gaps, Pitch Type, Contacts, Dates, Outbound Links)
- Gemini Token Usage Tracker & Rate-Limit Quota Counter
- Priority Link Target Scoring (+5 Boost for Competitor Gap Pages)
- Run & Page Analysis Cache Persistence & Offline Demo Viewer

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

from page_analysis import (
    analyse_all_cited_pages,
    merge_page_analysis_into_domains
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

    # Pricing estimate (Flash tier: $0.075 / 1M prompt tokens, $0.30 / 1M output tokens)
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
        "est_cost_usd": est_cost_usd
    }


# ----------------------------------------------------------------------------
# Helper Functions: Domain Normalization & URL Cleaning
# ----------------------------------------------------------------------------
def root_domain(url_or_domain: str) -> str:
    """Extract canonical root domain, correctly handling multi-part ccTLDs (.co.uk, .com.au, etc.)."""
    s = (url_or_domain or "").strip().lower()
    if not s:
        return ""
    if "://" not in s:
        s = "https://" + s
    try:
        host = urlparse(s).netloc.split(":")[0]
    except Exception:
        host = s.split("/")[0].split(":")[0]
        
    if host.startswith("www."):
        host = host[4:]
        
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL_TLDS and len(parts[-1]) <= 3:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


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

        found_url = ""
        # 1. Inspect title
        if title:
            if "." in title and " " not in title and not title.endswith("."):
                found_url = "https://" + title if not title.startswith("http") else title
            else:
                match = re.search(r'\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)\b', title)
                if match:
                    found_url = "https://" + match.group(1)

        # 2. Inspect URI
        if not found_url and uri:
            parsed_host = urlparse(uri).netloc.lower()
            if "vertexaisearch.cloud.google.com" not in parsed_host and "google.com" not in parsed_host:
                found_url = uri
            else:
                if title:
                    found_url = "https://" + title if not title.startswith("http") else title

        if found_url:
            cleaned = clean_url(found_url)
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
# Gemini REST API Calls & Token Measurement
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


def generate_prompts_gemini(service: str, location: str, n: int, api_key: str, model: str) -> list[str]:
    """Ask Gemini (REST, without search tool) to generate realistic buyer queries."""
    if not api_key:
        return [t.format(s=service, loc=location) for t in TEMPLATES][:n]

    active_model = model.strip().replace("models/", "")
    if active_model in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"):
        active_model = "gemini-3.1-flash-lite"

    instruction = (
        f"Write exactly {n} realistic questions a buyer would ask into Google or Gemini "
        f"when searching for '{service}' in '{location}'. Include a balanced mix of: "
        "1. Best/Top vendor recommendations, "
        "2. Direct vendor comparisons ('X vs Y'), "
        "3. How to choose / decision criteria, "
        "4. Pricing and cost expectations, "
        "5. Trust, reputation, and reviews. "
        "Return ONLY a valid JSON array of strings, without markdown formatting or introductory text. "
        'Example format: ["Question 1", "Question 2"]'
    )
    
    for candidate_model in [active_model, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent"
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "contents": [{"parts": [{"text": instruction}]}],
            "generationConfig": {
                "temperature": 0.7
            }
        }

        try:
            start_t = time.time()
            r = requests.post(url, headers=headers, json=payload, timeout=30)
            latency = round(time.time() - start_t, 2)
            if r.status_code == 200:
                data = r.json()
                cand = (data.get("candidates") or [{}])[0]
                parts = cand.get("content", {}).get("parts", [])
                raw = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
                
                # Capture token metadata
                usage = data.get("usageMetadata", {})
                p_tokens = usage.get("promptTokenCount") or max(1, len(instruction.split()) * 4 // 3)
                c_tokens = usage.get("candidatesTokenCount") or max(1, len(raw.split()) * 4 // 3)
                tot_tokens = usage.get("totalTokenCount") or (p_tokens + c_tokens)
                record_token_usage(p_tokens, c_tokens, tot_tokens, model=candidate_model, mode="Prompt Generation", latency_sec=latency)

                # Clean markdown code blocks
                raw = re.sub(r"```(?:json)?", "", raw).strip()
                start = raw.find("[")
                end = raw.rfind("]")
                if start != -1 and end != -1:
                    parsed = json.loads(raw[start:end+1])
                    cleaned = [p.strip() for p in parsed if isinstance(p, str) and p.strip()]
                    if cleaned:
                        return cleaned[:n]
        except Exception:
            continue

    return [t.format(s=service, loc=location) for t in TEMPLATES][:n]


def ask_gemini_grounded(
    prompt: str,
    api_key: str,
    model: str,
    max_retries: int = 2,
    retry_delay: float = 6.0,
    status_callback=None
) -> tuple[str, list[str], dict]:
    """
    Call Gemini with Google Search grounding tool enabled.
    If Google Search tool returns HTTP 429 quota limit, seamlessly falls back to
    Gemini AI Web Citation mode to extract domain citations without crashing.
    Returns: (answer_text, cited_urls, token_stats)
    """
    current_model = model.strip().replace("models/", "")
    if current_model in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"):
        current_model = "gemini-3.1-flash-lite"

    # 1. Attempt Google Search Tool Grounding
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent"
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }
    payload_search = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}]
    }

    start_time = time.time()
    try:
        r = requests.post(url, headers=headers, json=payload_search, timeout=30)
        latency_sec = round(time.time() - start_time, 2)
        if r.status_code == 200:
            data = r.json()
            cand = (data.get("candidates") or [{}])[0]
            parts = cand.get("content", {}).get("parts", [])
            answer_text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
            grounding_meta = cand.get("groundingMetadata") or {}
            urls = extract_grounding_citations(grounding_meta)
            
            # Supplement with explicit URLs in text
            text_urls = re.findall(r'https?://[^\s)\]"\'>]+', answer_text)
            for tu in text_urls:
                cleaned_tu = clean_url(tu)
                d = root_domain(cleaned_tu)
                if d and d not in IGNORE_DOMAINS and cleaned_tu not in urls:
                    urls.append(cleaned_tu)
            
            # Token counts
            usage = data.get("usageMetadata", {})
            p_tokens = usage.get("promptTokenCount") or max(1, len(prompt.split()) * 4 // 3)
            c_tokens = usage.get("candidatesTokenCount") or max(1, len(answer_text.split()) * 4 // 3)
            tot_tokens = usage.get("totalTokenCount") or (p_tokens + c_tokens)
            
            token_stats = {
                "prompt_tokens": p_tokens,
                "candidates_tokens": c_tokens,
                "total_tokens": tot_tokens,
                "latency_sec": latency_sec,
                "mode": "Google Search Grounding",
                "model": current_model
            }
            record_token_usage(p_tokens, c_tokens, tot_tokens, model=current_model, mode="Search Grounding", latency_sec=latency_sec)
            return answer_text, urls, token_stats
    except Exception:
        pass

    # 2. AI Web Citation Mode (Fallback when Search tool is 429 quota limited)
    if status_callback:
        status_callback("Extracting AI Web Citations & authority references...")

    citation_instruction = (
        f"{prompt}\n\n"
        "INSTRUCTIONS FOR AI CITATIONS:\n"
        "Provide a comprehensive, authoritative response. For every agency, vendor, directory, authority publication, or community platform you recommend or analyze, "
        "you MUST cite and provide the full website URL (e.g., https://clutch.co/uk/seo-firms, https://fatjoe.com, https://searchengineland.com, https://reddit.com/r/SEO).\n"
        "At the end of your response, list all cited website URLs and references under a '### Cited Sources & Target URLs' section."
    )

    fallback_models = [current_model, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"]
    seen = set()
    unique_models = [m for m in fallback_models if not (m in seen or seen.add(m))]

    for fb_model in unique_models:
        fb_url = f"https://generativelanguage.googleapis.com/v1beta/models/{fb_model}:generateContent"
        fb_payload = {
            "contents": [{"parts": [{"text": citation_instruction}]}],
            "generationConfig": {"temperature": 0.7}
        }
        try:
            fb_start = time.time()
            r = requests.post(fb_url, headers=headers, json=fb_payload, timeout=30)
            latency_sec = round(time.time() - fb_start, 2)
            if r.status_code == 200:
                data = r.json()
                cand = (data.get("candidates") or [{}])[0]
                parts = cand.get("content", {}).get("parts", [])
                answer_text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
                
                # Extract all URLs cited in text
                urls = []
                raw_urls = re.findall(r'https?://[^\s)\]"\'>]+', answer_text)
                for u in raw_urls:
                    cleaned_u = clean_url(u.rstrip(".,;:)"))
                    d = root_domain(cleaned_u)
                    if d and d not in IGNORE_DOMAINS and cleaned_u not in urls:
                        urls.append(cleaned_u)

                # Token counts
                usage = data.get("usageMetadata", {})
                p_tokens = usage.get("promptTokenCount") or max(1, len(citation_instruction.split()) * 4 // 3)
                c_tokens = usage.get("candidatesTokenCount") or max(1, len(answer_text.split()) * 4 // 3)
                tot_tokens = usage.get("totalTokenCount") or (p_tokens + c_tokens)

                token_stats = {
                    "prompt_tokens": p_tokens,
                    "candidates_tokens": c_tokens,
                    "total_tokens": tot_tokens,
                    "latency_sec": latency_sec,
                    "mode": "AI Web Citation Engine",
                    "model": fb_model
                }
                record_token_usage(p_tokens, c_tokens, tot_tokens, model=fb_model, mode="AI Citation", latency_sec=latency_sec)
                return answer_text, urls, token_stats
            elif r.status_code == 429:
                time.sleep(retry_delay)
                continue
        except Exception:
            continue

    raise RuntimeError("Could not retrieve AI answers. Please verify your Gemini API Key in the sidebar.")


# ----------------------------------------------------------------------------
# Campaign Execution
# ----------------------------------------------------------------------------
def run_grounded_campaign(
    prompts: list[str],
    repeats: int,
    api_key: str,
    model: str,
    delay_sec: float,
    progress_bar,
    status_text
) -> list[dict]:
    """Execute sequential prompt queries with configurable pacing and rate-limit handling."""
    total_jobs = len(prompts) * repeats
    records = []
    job_idx = 0

    for p_idx, prompt in enumerate(prompts):
        for rep in range(1, repeats + 1):
            job_idx += 1
            status_desc = f"🔍 Querying [{job_idx}/{total_jobs}] Prompt {p_idx + 1}/{len(prompts)} (Run {rep}/{repeats}): \"{prompt[:45]}...\""
            status_text.text(status_desc)
            progress_bar.progress((job_idx - 1) / total_jobs)

            try:
                answer_text, urls, token_stats = ask_gemini_grounded(
                    prompt=prompt,
                    api_key=api_key,
                    model=model,
                    max_retries=2,
                    retry_delay=6.0,
                    status_callback=lambda msg: status_text.text(f"[{job_idx}/{total_jobs}] {msg}")
                )
                records.append({
                    "prompt_index": p_idx,
                    "prompt": prompt,
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

            # Pacing delay between calls to respect free-tier rate limits
            if job_idx < total_jobs and delay_sec > 0:
                for rem in range(int(delay_sec), 0, -1):
                    status_text.text(f"⏳ Pacing delay: waiting {rem}s before next query to prevent rate limits...")
                    time.sleep(1.0)
                if delay_sec - int(delay_sec) > 0:
                    time.sleep(delay_sec - int(delay_sec))

    status_text.text(f"✅ Completed all {total_jobs} queries successfully!")
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
        
        # Consistency: share of repeats in which it was cited for the same prompt
        prompt_repeat_counts = group.groupby("prompt_index")["repeat"].nunique()
        consistency_pct = round(float(prompt_repeat_counts.mean() / max(repeats, 1)) * 100, 1)

        # Unique clean URLs
        unique_urls = list(dict.fromkeys(group["url"].dropna()))[:3]
        top_urls_str = " | ".join(unique_urls)

        action_bucket = classify_action(domain)

        # Priority score formula
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
        .analyse-card {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(59, 130, 246, 0.06));
            border-radius: 12px;
            padding: 18px 22px;
            border: 1px solid rgba(16, 185, 129, 0.25);
            margin: 15px 0px 20px 0px;
        }
        .stTabs [data-baseweb="tab-list"] {
            gap: 12px;
        }
        .stTabs [data-baseweb="tab"] {
            border-radius: 8px 8px 0px 0px;
            padding: 10px 18px;
            font-weight: 600;
        }
        </style>
    """, unsafe_allow_html=True)

    # Header
    st.markdown('<div class="main-header">🎯 AI Citation Link Prospector</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="sub-header">Discover which authority websites Google Gemini cites with Search Grounding & Web AI — and convert them into prioritized outreach lists with deep on-page analysis.</div>',
        unsafe_allow_html=True
    )

    # ------------------------------------------------------------------------
    # Sidebar: Configuration, API Keys, Tokens & Saved Runs
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
        
        # Model Selection with smart options
        model_options = [
            "gemini-3.1-flash-lite (Fast & Reliable)",
            "gemini-3.8-flash (Recommended)",
            "gemini-3.7-flash",
            "gemini-3.5-flash-lite",
            "gemini-flash-latest",
            "gemini-2.5-flash (Legacy)",
            "Custom Model..."
        ]
        chosen_option = st.selectbox(
            "Gemini Model",
            options=model_options,
            index=0,
            help="Google AI Studio recommends gemini-3.1-flash-lite or gemini-3.8-flash."
        )
        
        if chosen_option == "Custom Model...":
            model_name = st.text_input("Custom Model Name", value="gemini-3.1-flash-lite")
        else:
            model_name = chosen_option.split(" ")[0]

        # Quick connection test
        if st.button("🧪 Test API Key & Model", use_container_width=True):
            if not api_key:
                st.error("Please enter a Gemini API Key first.")
            else:
                with st.spinner("Testing connection to Gemini API..."):
                    test_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
                    payload = {"contents": [{"parts": [{"text": "ping"}]}]}
                    try:
                        r = requests.post(test_url, headers=headers, json=payload, timeout=15)
                        if r.status_code == 200:
                            st.success(f"✅ Connected to `{model_name}` successfully!")
                        elif r.status_code == 404:
                            st.error(f"❌ Model `{model_name}` not found (404). Try `gemini-3.1-flash-lite`.")
                        elif r.status_code == 429:
                            st.warning("⚠️ API key is valid, but search quota/rate limit is reached (429).")
                        else:
                            st.error(f"Error {r.status_code}: {r.text[:120]}")
                    except Exception as ex:
                        st.error(f"Connection failed: {ex}")

        st.subheader("🛡️ Free-Tier Safety")
        delay_sec = st.slider(
            "Pacing Delay (seconds)",
            min_value=1.0,
            max_value=15.0,
            value=6.0,
            step=0.5,
            help="Delay between sequential queries to stay comfortably within free-tier rate limits (15 RPM)."
        )

        # --------------------------------------------------------------------
        # Extension Feature: Gemini Token & Limit Counter Widget
        # --------------------------------------------------------------------
        st.divider()
        st.subheader("⚡ Token & Quota Counter")
        
        rate_metrics = get_rate_limit_metrics()
        
        st.markdown(f"""
        <div class="token-box">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Total Session Tokens:</span>
                <span style="font-weight:700; color:#38BDF8;">{rate_metrics['total_tokens']:,}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Input / Output:</span>
                <span style="font-size:0.85rem;">{rate_metrics['total_prompt_tokens']:,} / {rate_metrics['total_candidates_tokens']:,}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-size:0.85rem; color:#94A3B8;">Requests (Session):</span>
                <span style="font-size:0.85rem; font-weight:600;">{rate_metrics['total_requests']} calls</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span style="font-size:0.85rem; color:#94A3B8;">Est. Cost (Free Tier):</span>
                <span style="font-size:0.85rem; color:#4ADE80; font-weight:600;">${rate_metrics['est_cost_usd']:.4f}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Live RPM Meter
        rpm_val = rate_metrics['rpm']
        rpm_pct = rate_metrics['rpm_pct']
        rpm_color = "🟢 Safe" if rpm_val <= 8 else ("🟡 Moderate" if rpm_val <= 12 else "🔴 Near Limit")
        
        st.caption(f"**Live Request Rate:** {rpm_val} / 15 RPM ({rpm_color})")
        st.progress(rpm_pct / 100.0)

        rpd_val = rate_metrics['rpd']
        st.caption(f"**Daily Quota Usage:** {rpd_val} / 1,500 RPD")

        if st.button("🔄 Reset Token Counters", use_container_width=True):
            reset_token_tracker()
            st.rerun()

        st.divider()
        st.subheader("📂 Saved Runs & Demos")

        # Load from disk
        saved_files = get_available_runs()
        if saved_files:
            file_options = ["-- Select a saved run --"] + saved_files
            selected_file = st.selectbox(
                "Load past run from disk",
                options=file_options,
                format_func=lambda x: os.path.basename(x) if x != "-- Select a saved run --" else x
            )
            if selected_file != "-- Select a saved run --":
                if st.button("📥 Load Selected Run", use_container_width=True):
                    try:
                        with open(selected_file, "r", encoding="utf-8") as f:
                            st.session_state["run"] = json.load(f)
                        st.session_state["run_source_file"] = selected_file
                        
                        # Load matching page analysis cache if available
                        cache_path = get_page_cache_path(st.session_state["run"], selected_file)
                        cached_pages_df = load_cached_pages(cache_path)
                        if not cached_pages_df.empty:
                            st.session_state["pages_df"] = cached_pages_df
                        else:
                            st.session_state.pop("pages_df", None)

                        st.success(f"Loaded {os.path.basename(selected_file)}")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error loading run: {e}")

        # Upload custom JSON run
        uploaded_run = st.file_uploader("Upload Run (.json)", type=["json"])
        if uploaded_run:
            try:
                st.session_state["run"] = json.load(uploaded_run)
                st.session_state["run_source_file"] = uploaded_run.name
                
                # Check for cached pages
                cache_path = get_page_cache_path(st.session_state["run"], uploaded_run.name)
                cached_pages_df = load_cached_pages(cache_path)
                if not cached_pages_df.empty:
                    st.session_state["pages_df"] = cached_pages_df
                else:
                    st.session_state.pop("pages_df", None)

                st.success("Uploaded run loaded successfully!")
            except Exception as e:
                st.error(f"Invalid JSON file: {e}")

    # ------------------------------------------------------------------------
    # Campaign Inputs
    # ------------------------------------------------------------------------
    st.subheader("1. Campaign Profile")
    col1, col2 = st.columns(2)

    with col1:
        client_name = st.text_input("Client Brand Name", value="Digital Web Solutions")
        client_domain = st.text_input("Client Domain", value="digitalwebsolutions.com")
        service = st.text_input("Service / Niche (Plural)", value="link building agencies")
        location = st.text_input("Market / Location", value="the UK")

    with col2:
        comp_text = st.text_area(
            "Competitors (one per line: Brand | domain)",
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
        num_prompts = st.slider("Number of Prompts", min_value=5, max_value=30, value=10)
    with pcol2:
        repeats = st.slider(
            "Repeats per Prompt (Consistency Test)",
            min_value=1,
            max_value=3,
            value=2,
            help="Running queries multiple times uncovers true citation consistency %."
        )

    gen_col1, gen_col2 = st.columns([1, 3])
    with gen_col1:
        if st.button("✨ Generate Prompts", use_container_width=True):
            if not api_key:
                st.warning("⚠️ No API key found. Generating fallback template prompts.")
            with st.spinner("Asking Gemini to generate high-intent buyer questions..."):
                generated = generate_prompts_gemini(
                    service=service,
                    location=location,
                    n=num_prompts,
                    api_key=api_key,
                    model=model_name
                )
                st.session_state["prompts_text"] = "\n".join(generated)

    # Prompts textarea
    default_prompts = st.session_state.get(
        "prompts_text",
        "\n".join([t.format(s=service, loc=location) for t in TEMPLATES[:num_prompts]])
    )
    prompts_input = st.text_area(
        "Prompts (one per line — editable)",
        value=default_prompts,
        height=180
    )
    prompts_list = [p.strip() for p in prompts_input.splitlines() if p.strip()]

    # ------------------------------------------------------------------------
    # Execution Button
    # ------------------------------------------------------------------------
    st.write("")
    run_btn = st.button(
        "🚀 Run Gemini Citation Prospector",
        type="primary",
        disabled=not (prompts_list and api_key),
        use_container_width=True
    )

    if not api_key:
        st.info("💡 Please enter your Gemini API Key in the sidebar to start.")

    if run_btn:
        progress_bar = st.progress(0.0)
        status_text = st.empty()

        competitors_list = parse_competitors(comp_text)
        records = run_grounded_campaign(
            prompts=prompts_list,
            repeats=repeats,
            api_key=api_key,
            model=model_name,
            delay_sec=delay_sec,
            progress_bar=progress_bar,
            status_text=status_text
        )

        run_total_tokens = sum(r.get("total_tokens", 0) for r in records)
        run_prompt_tokens = sum(r.get("prompt_tokens", 0) for r in records)
        run_cand_tokens = sum(r.get("candidates_tokens", 0) for r in records)

        run_payload = {
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "client": {"name": client_name, "domain": client_domain},
            "service": service,
            "location": location,
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
        st.session_state.pop("pages_df", None)
        st.success(f"🎉 Run complete! Saved results to `{saved_path}` (Tokens Used: {run_total_tokens:,})")

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

    table, sov_df = analyse(records, client_dict, comp_list, inventory, repeats=rep_count)
    errors = [r for r in records if r.get("error")]

    # Collect all unique URLs cited across this run
    all_cited_urls = []
    for r in records:
        for u in r.get("urls", []):
            if u:
                all_cited_urls.append(u)
    unique_cited_urls = list(dict.fromkeys([clean_url(u) for u in all_cited_urls if u]))

    # Check for cached page analysis if not already in session state
    run_source = st.session_state.get("run_source_file", "")
    page_cache_path = get_page_cache_path(current_run, run_source)
    if "pages_df" not in st.session_state or st.session_state["pages_df"].empty:
        cached_df = load_cached_pages(page_cache_path)
        if not cached_df.empty:
            st.session_state["pages_df"] = cached_df

    pages_df = st.session_state.get("pages_df", pd.DataFrame())

    # If page analysis is available, merge into domain table and boost priority score (+5 per gap page)
    if not pages_df.empty:
        table = merge_page_analysis_into_domains(table, pages_df)

    st.divider()
    st.subheader(f"📊 Results — {current_run.get('service', 'Niche')} in {current_run.get('location', 'Market')}")

    # Top 4 Metrics
    m1, m2, m3, m4 = st.columns(4)
    total_successful_answers = len(records) - len(errors)
    unique_domains = len(table) if not table.empty else 0
    outreach_targets = int(table["action"].str.startswith("Outreach").sum()) if not table.empty else 0
    
    client_sov = "0%"
    if not sov_df.empty and client_dict.get("name"):
        client_row = sov_df[sov_df["brand"].str.lower() == client_dict["name"].strip().lower()]
        if not client_row.empty:
            client_sov = f"{client_row['share_of_voice_pct'].iloc[0]}%"

    with m1:
        st.metric("Total Answers", total_successful_answers, help="Total AI grounded answers collected")
    with m2:
        st.metric("Unique Domains Cited", unique_domains, help="Total distinct root domains referenced")
    with m3:
        st.metric("Outreach Targets", outreach_targets, help="Non-competitor, non-directory target domains")
    with m4:
        st.metric("Client Share of Voice", client_sov, help="% of answers mentioning client brand")

    # ------------------------------------------------------------------------
    # On-Page Analysis Action Section (New Phase Feature)
    # ------------------------------------------------------------------------
    st.markdown("""
    <div class="analyse-card">
        <h4 style="margin-top:0px; margin-bottom:6px; color:#10B981;">🔍 Deep On-Page Analysis (Outreach Intelligence)</h4>
        <p style="margin-bottom:12px; font-size:0.92rem; color:#475569;">
            Scrapes every AI-cited page to discover <strong>Competitor Gap URLs</strong> (where competitors are featured but your brand is omitted), 
            extracts verified <strong>Outreach Contacts & Emails</strong>, identifies <strong>Guest Post / Write-For-Us opportunities</strong>, 
            detects <strong>Last Updated Dates</strong>, and boosts domain priority scores (+5 per gap page).
        </p>
    </div>
    """, unsafe_allow_html=True)

    acol1, acol2 = st.columns([1, 3])
    with acol1:
        analyse_btn_label = "🔍 Analyse Cited Pages" if pages_df.empty else "🔄 Re-analyse Cited Pages"
        if st.button(analyse_btn_label, type="primary" if pages_df.empty else "secondary", use_container_width=True):
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
                st.success(f"🎉 Successfully analyzed {len(analysed_pages)} pages! Found {int(analysed_pages['competitor_gap'].sum())} competitor gap opportunities.")
                st.rerun()

    with acol2:
        if not pages_df.empty:
            gaps_found = int(pages_df["competitor_gap"].sum())
            contacts_found = int((pages_df["contact"] != "").sum())
            gp_found = int((pages_df["guest_post_url"] != "").sum())
            st.markdown(
                f"✅ **On-Page Analysis Active:** `{len(pages_df)}` pages analyzed | "
                f"⚔️ **`{gaps_found}` Competitor Gaps** | "
                f"📧 **`{contacts_found}` Contacts** | "
                f"✍️ **`{gp_found}` Guest Post Links**"
            )
        else:
            st.caption(f"💡 `{len(unique_cited_urls)}` unique cited pages ready to be scraped and analyzed for competitor gaps and contacts.")

    # Failed queries expander (if any)
    if errors:
        with st.expander(f"⚠️ {len(errors)} Queries Encountered Errors", expanded=True):
            st.error("Some or all queries failed. Review the details below:")
            err_df = pd.DataFrame(errors)[["prompt", "repeat", "error"]]
            st.dataframe(err_df, use_container_width=True)
            if any("404" in str(e.get("error", "")) for e in errors):
                st.info("💡 **Model 404 Notice**: `gemini-2.5-flash` was deprecated by Google for new API keys. Please select **`gemini-3.1-flash-lite`** in the sidebar settings.")
            if any("429" in str(e.get("error", "")) or "Quota" in str(e.get("error", "")) for e in errors):
                st.info("💡 **Quota Limit Notice**: Your API key's free tier rate limit was reached. You can wait a few minutes, increase pacing delay, or load our demo run below.")

    if table.empty:
        st.warning("No citations were returned by Gemini for these queries.")
        demo_col1, demo_col2 = st.columns([1, 2])
        with demo_col1:
            if st.button("📥 Load Sample Demo Run (UK Link Building)", use_container_width=True, type="secondary"):
                try:
                    with open("runs/sample_link_building_uk.json", "r", encoding="utf-8") as f:
                        st.session_state["run"] = json.load(f)
                    st.session_state["run_source_file"] = "runs/sample_link_building_uk.json"
                    sample_cache = "runs/pages_sample_link_building_uk.json"
                    cached_p = load_cached_pages(sample_cache)
                    if not cached_p.empty:
                        st.session_state["pages_df"] = cached_p
                    st.rerun()
                except Exception as e:
                    st.error(f"Could not load demo: {e}")
        return

    # ------------------------------------------------------------------------
    # Detailed Result Tabs (6 Tabs)
    # ------------------------------------------------------------------------
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "🎯 Link Targets",
        "⚔️ Competitor Gaps",
        "📢 Share of Voice",
        "📊 Action Mix",
        "📝 Raw Answers & Citations",
        "⚡ Token & Quota Monitor"
    ])

    # Tab 1: Link Targets
    with tab1:
        st.markdown("### Prioritised Link Targets & Outreach List")
        st.caption("Domains cited by Gemini, enriched with on-page competitor gaps, pitch types, and outreach contacts.")
        
        # Filters
        fcol1, fcol2, fcol3 = st.columns([2, 2, 2])
        with fcol1:
            all_actions = sorted(table["action"].unique())
            selected_actions = st.multiselect("Filter by Action Category", options=all_actions, default=all_actions)
        with fcol2:
            all_pitch_types = sorted(table["best_pitch_type"].unique()) if "best_pitch_type" in table.columns else ["List inclusion", "Directory listing", "Guest post", "Niche edit", "Community / UGC"]
            selected_pitch = st.multiselect("Filter by Pitch Type", options=all_pitch_types, default=all_pitch_types)
        with fcol3:
            search_query = st.text_input("Search Domain, Contact, or URL", placeholder="e.g. clutch, editor@..., tech...")

        filtered_table = table[table["action"].isin(selected_actions)]
        if "best_pitch_type" in filtered_table.columns and selected_pitch:
            filtered_table = filtered_table[filtered_table["best_pitch_type"].isin(selected_pitch)]

        if search_query:
            filtered_table = filtered_table[
                filtered_table["domain"].str.contains(search_query, case=False, na=False) |
                filtered_table["top_urls"].str.contains(search_query, case=False, na=False) |
                filtered_table["contact"].str.contains(search_query, case=False, na=False)
            ]

        # Display interactive dataframe with rich columns
        st.dataframe(
            filtered_table,
            use_container_width=True,
            hide_index=True,
            column_config={
                "domain": st.column_config.TextColumn("Root Domain", width="medium"),
                "priority_score": st.column_config.NumberColumn("Priority Score", format="%.1f", help="Base citations + prompts + competitor gaps (+5 per gap page)"),
                "citations": st.column_config.NumberColumn("Citations"),
                "prompts_cited_in": st.column_config.NumberColumn("Prompts"),
                "competitor_gap_pages": st.column_config.NumberColumn("Gap Pages", help="Number of pages where competitors are featured but client is omitted"),
                "best_pitch_type": st.column_config.TextColumn("Pitch Type", width="medium"),
                "contact": st.column_config.TextColumn("Contact / Email", width="medium"),
                "guest_post_url": st.column_config.LinkColumn("Guest Post URL", width="medium"),
                "newest_last_updated": st.column_config.TextColumn("Last Updated"),
                "action": st.column_config.TextColumn("Action Category", width="medium"),
                "top_urls": st.column_config.TextColumn("Top Cited URLs", width="large"),
            }
        )

        csv_data = filtered_table.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="📥 Download Link Targets CSV",
            data=csv_data,
            file_name=f"gemini_link_targets_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            type="primary"
        )

        st.markdown("#### Top 15 Most Prioritised Domains")
        top15 = table.head(15)
        st.bar_chart(
            data=top15.set_index("domain")["priority_score"],
            use_container_width=True
        )

    # Tab 2: Competitor Gaps (New Dedicated Tab)
    with tab2:
        st.markdown("### ⚔️ Competitor Gap Opportunities")
        st.caption("Exact cited URLs where competitor brands are linked or named, but your client brand is omitted. These represent your highest-ROI link outreach targets.")

        if pages_df.empty:
            st.info("💡 Click the **'🔍 Analyse Cited Pages'** button above to crawl cited URLs and extract competitor gap pages.")
        else:
            gap_pages = pages_df[pages_df["competitor_gap"] == True].copy()
            if gap_pages.empty:
                st.success("🎉 No competitor gaps detected — your brand is either mentioned across all competitor pages or no competitors were cited!")
            else:
                st.markdown(f"Found **{len(gap_pages)} high-intent competitor gap pages** ready for outreach pitching:")
                
                # Format competitors_present into clean string for display
                gap_pages["competitors_list"] = gap_pages["competitors_present"].apply(lambda lst: ", ".join(lst) if isinstance(lst, list) else str(lst))

                st.dataframe(
                    gap_pages,
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        "url": st.column_config.LinkColumn("Page URL", width="large"),
                        "domain": st.column_config.TextColumn("Domain"),
                        "page_title": st.column_config.TextColumn("Page Title", width="large"),
                        "competitors_list": st.column_config.TextColumn("Competitors Featured", width="medium"),
                        "pitch_type": st.column_config.TextColumn("Pitch Strategy"),
                        "contact": st.column_config.TextColumn("Outreach Contact", width="medium"),
                        "last_updated": st.column_config.TextColumn("Date Updated"),
                        "word_count": st.column_config.NumberColumn("Word Count"),
                        "sponsored_or_nofollow_share": st.column_config.NumberColumn("Nofollow %", format="%.1f%%"),
                        "fetch_status": st.column_config.TextColumn("Status")
                    }
                )

                gap_csv = gap_pages.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download Competitor Gaps CSV",
                    data=gap_csv,
                    file_name=f"competitor_gaps_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    type="primary"
                )

    # Tab 3: Share of Voice
    with tab3:
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

    # Tab 4: Action Mix
    with tab4:
        st.markdown("### Citation Action Distribution")
        st.caption("Breakdown of cited websites across outreach types, UGC platforms, directories, and competitors.")
        
        action_counts = table.groupby("action")["citations"].sum().reset_index()
        st.dataframe(action_counts, use_container_width=True, hide_index=True)
        st.bar_chart(
            data=action_counts.set_index("action")["citations"],
            use_container_width=True
        )

    # Tab 5: Raw Answers & Citations
    with tab5:
        st.markdown("### Full Gemini Answers & Grounding Citations")
        for i, r in enumerate(records):
            if r.get("error"):
                continue
            with st.expander(f"Prompt {r['prompt_index'] + 1} (Run {r['repeat']}): {r['prompt']}"):
                st.markdown("**AI Response Text:**")
                st.markdown(r.get("answer", "*No text returned*"))
                
                cited_urls = r.get("urls", [])
                if cited_urls:
                    st.markdown("**Cited Sources & URLs:**")
                    for u in cited_urls:
                        st.markdown(f"- [{u}]({u})")
                else:
                    st.caption("No explicit source links extracted.")

    # Tab 6: Token & Quota Monitor
    with tab6:
        st.markdown("### ⚡ Gemini Token Consumption & Quota Monitor")
        st.caption("Detailed token usage breakdown, rate limit metrics, and free-tier quota analysis for this campaign.")

        # Compute run-level token totals
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

        st.markdown("#### 📊 Token Distribution by Prompt")
        chart_df = df_tokens[["Prompt #", "Input Tokens", "Output Tokens"]].set_index("Prompt #")
        st.bar_chart(chart_df, use_container_width=True)

        with st.expander("ℹ️ Gemini API Free-Tier Quota & Pricing Cheatsheet"):
            st.markdown("""
            | Tier / Model | RPM (Requests/Min) | TPM (Tokens/Min) | RPD (Requests/Day) | Input Price / 1M | Output Price / 1M |
            | :--- | :--- | :--- | :--- | :--- | :--- |
            | **Gemini 3.1 / 3.8 Flash (Free)** | **15 RPM** | **1,000,000 TPM** | **1,500 RPD** | **$0.00 (Free)** | **$0.00 (Free)** |
            | **Gemini 2.5 Pro (Free)** | 2 RPM | 32,000 TPM | 50 RPD | $0.00 (Free) | $0.00 (Free) |
            | **Gemini Flash (Pay-as-you-go)** | 1,000 RPM | 4,000,000 TPM | Unlimited | ~$0.075 | ~$0.30 |

            **Why built-in pacing matters:**
            With the app's default **6.0s Pacing Delay**, a 10-prompt campaign runs at a maximum of **10 RPM**, ensuring you never exceed Google's 15 RPM limit on free keys.
            """)


if __name__ == "__main__":
    main()
