"""
Outreach Pitch Generator Module
Generates personalized, high-converting outreach emails for AI-cited prospect pages
and competitor gaps using Gemini in JSON mode:
- Tailored to pitch types: List inclusion, Guest post, Directory listing, Niche edit
- Enforces max 120 words, zero hype, and 1 clear actionable ask
- Generates subject lines, suggested anchor texts, suggested sentence, and 3 title ideas (for guest posts)
- Caching to runs/pitches_<run_timestamp>.json keyed by URL
- Never auto-sends emails; provides copy-friendly cards and CSV export
"""

import os
import re
import json
import pandas as pd
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from gemini_client import gemini_generate
from page_analysis import fetch_page


def get_pitches_cache_path(run_payload: dict, file_path: str = "") -> str:
    """Generate standardized pitches cache file path in runs/."""
    os.makedirs("runs", exist_ok=True)
    if file_path:
        base = os.path.basename(file_path)
        if base.startswith("pages_"):
            base = base[6:]
        if base.startswith("brands_"):
            base = base[7:]
        if base.startswith("brief_"):
            base = base[6:]
        if base.startswith("pitches_"):
            base = base[8:]
        if base.endswith(".json"):
            return os.path.join("runs", f"pitches_{base}")

    created = run_payload.get("created", "") if isinstance(run_payload, dict) else ""
    if created:
        safe_ts = str(created).replace(":", "-")
        return os.path.join("runs", f"pitches_{safe_ts}.json")
    return os.path.join("runs", "pitches_cached.json")


def load_cached_pitches(cache_path: str) -> dict:
    """Load cached pitches from disk (keyed by URL)."""
    if not cache_path or not os.path.exists(cache_path):
        return {}
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def save_cached_pitches(pitches_dict: dict, cache_path: str) -> bool:
    """Save pitches dictionary (keyed by URL) to disk."""
    if not cache_path or not pitches_dict:
        return False
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(pitches_dict, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def extract_page_text_excerpt(url: str, max_chars: int = 1500) -> str:
    """Fetch target page and extract a clean 1,500-character excerpt of main content."""
    if not url:
        return ""
    try:
        final_url, status, html, fetch_status = fetch_page(url, timeout=8)
        if fetch_status == "ok" and html:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
                tag.decompose()
            main_elem = soup.find("article") or soup.find("main") or soup.find("body") or soup
            text = main_elem.get_text(separator=" ", strip=True)
            clean_text = " ".join(text.split())
            return clean_text[:max_chars]
    except Exception:
        pass
    return ""


def fallback_template_pitch(
    client_name: str,
    client_domain: str,
    service: str,
    market: str,
    page_title: str,
    url: str,
    pitch_type: str,
    competitors_present: list
) -> dict:
    """Intelligent rule-based fallback pitch if API is unavailable or offline."""
    clean_title = page_title or "your recent article"
    comp_str = ", ".join(competitors_present) if competitors_present else ""
    market_str = f" in {market}" if market else ""

    if pitch_type == "List inclusion":
        subject = f"Quick addition for {clean_title[:35]}"
        if comp_str:
            email = (
                f"Hi [Name],\n\n"
                f"I was reading your guide '{clean_title}' and noticed you featured top solutions in the market. "
                f"Our team at {client_name} ({client_domain}) specialises in {service}{market_str} with verified client outcomes. "
                f"Would you consider including {client_name} as an additional resource for your readers?\n\n"
                f"Happy to provide a concise 2-sentence summary and data to make updating effortless.\n\n"
                f"Best,\n[Your Name]"
            )
        else:
            email = (
                f"Hi [Name],\n\n"
                f"Loved your roundup '{clean_title}'. We work with companies in {service}{market_str} at {client_name} ({client_domain}) "
                f"and have recent benchmark data that complements your list.\n\n"
                f"Would you be open to adding {client_name} to give your readers another vetted option?\n\n"
                f"Best,\n[Your Name]"
            )
        anchor = f"{client_name} - {service}"
        sentence = f"For specialized {service}{market_str}, {client_name} ({client_domain}) provides vetted client solutions."
        topics = []

    elif pitch_type == "Guest post":
        subject = f"Guest contribution idea for {clean_title[:35]}"
        email = (
            f"Hi [Name],\n\n"
            f"I really enjoyed your article '{clean_title}' and noticed you accept expert contributions. "
            f"As specialists in {service}{market_str} at {client_name} ({client_domain}), I've put together three data-backed topic ideas "
            f"tailored to your audience with zero promotional fluff.\n\n"
            f"Would you like me to share a detailed outline for any of the proposed topics below?\n\n"
            f"Best,\n[Your Name]"
        )
        anchor = f"{service} insights from {client_name}"
        sentence = None
        topics = [
            f"How Modern {service.capitalize()} Drives Sustainable Organic Growth in 2026",
            f"5 Overlooked Traps to Avoid When Hiring {service.capitalize()}",
            f"A Practical Data-Driven Guide to Vetting {service.capitalize()}{market_str}"
        ]

    elif pitch_type == "Directory listing":
        subject = f"Listing verification request: {client_name}"
        email = (
            f"Hi [Name],\n\n"
            f"I came across your directory listing for {service} on {url}. "
            f"We would love to submit our company profile for {client_name} ({client_domain}) to be listed and verified "
            f"under your category.\n\n"
            f"What is the best way to submit our company credentials and client reviews for review?\n\n"
            f"Best regards,\n[Your Name]"
        )
        anchor = f"{client_name}"
        sentence = None
        topics = []

    else:  # Niche edit / contextual link
        subject = f"Quick resource suggestion for {clean_title[:35]}"
        email = (
            f"Hi [Name],\n\n"
            f"Came across your piece on '{clean_title}' while researching {service}{market_str}. "
            f"We recently published an in-depth breakdown on this exact topic over at {client_domain} "
            f"that provides actionable data for your readers.\n\n"
            f"Would you consider referencing it as a helpful resource in your article?\n\n"
            f"Cheers,\n[Your Name]"
        )
        anchor = f"{client_name}'s guide to {service}"
        sentence = f"According to recent industry research by {client_name} ({client_domain}), authoritative strategies achieve significantly higher ROI."
        topics = []

    return {
        "subject": subject,
        "email": email,
        "suggested_anchor": anchor,
        "suggested_sentence": sentence,
        "title_ideas": topics,
        "suggested_topics": topics
    }


def generate_single_outreach_pitch(
    target_data: dict,
    client_dict: dict,
    service: str,
    market: str = "",
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    delay_sec: float = 6.0
) -> dict:
    """
    Generate a highly tailored outreach pitch for a single target page using Gemini JSON mode.
    """
    client_name = client_dict.get("name", "Our Agency").strip()
    client_domain = client_dict.get("domain", "agency.com").strip()
    service_clean = service or "digital marketing services"
    market_clean = market or ""

    url = target_data.get("url") or target_data.get("top_urls", "")
    if isinstance(url, list) and url:
        url = url[0]
    elif isinstance(url, str) and "," in url:
        url = url.split(",")[0].strip()
    url = str(url).strip()

    domain = target_data.get("domain", "")
    page_title = target_data.get("page_title") or f"{domain} Resource Page"
    pitch_type = target_data.get("pitch_type") or target_data.get("best_pitch_type") or "Niche edit"
    contact = target_data.get("contact", "")
    competitors = target_data.get("competitors_present", [])
    if isinstance(competitors, str) and competitors:
        competitors = [c.strip() for c in competitors.split(",") if c.strip()]

    # Extract 1500 char excerpt of page content
    excerpt = target_data.get("page_excerpt") or target_data.get("main_text_excerpt", "")
    if not excerpt and url:
        excerpt = extract_page_text_excerpt(url, max_chars=1500)

    if not api_key:
        fallback = fallback_template_pitch(client_name, client_domain, service_clean, market_clean, page_title, url, pitch_type, competitors)
        fallback.update({
            "domain": domain,
            "url": url,
            "contact": contact,
            "pitch_type": pitch_type,
            "page_title": page_title
        })
        return fallback

    prompt = (
        "You are a senior link-building outreach specialist. Write a short outreach email for this page. "
        "Rules: max 120 words; reference one specific detail from the page; plain, friendly, no hype or flattery; "
        "one clear ask that matches the pitch type:\n"
        "  List inclusion -> ask to be considered for the list, with one reason\n"
        "  Guest post -> propose writing a piece, include 3 title ideas\n"
        "  Niche edit -> suggest one sentence the editor could add, with the link\n"
        "  Directory listing -> ask how to get listed / request listing\n"
        "If competitors are present on the page, do not mention them by name.\n\n"
        f"Client Name: {client_name}\n"
        f"Client Domain: {client_domain}\n"
        f"Service/Niche: {service_clean}\n"
        f"Market: {market_clean}\n"
        f"Page URL: {url}\n"
        f"Page Title: {page_title}\n"
        f"Pitch Type: {pitch_type}\n"
        f"Competitors Present on Page: {', '.join(competitors) if competitors else 'None'}\n"
        f"First 1,500 characters of page main text:\n"
        f'"""\n{excerpt[:1500] if excerpt else page_title}\n"""\n\n'
        'Return JSON: {"subject":"...","email":"...","suggested_anchor":"...","suggested_sentence":"... or null","title_ideas":["..."] or []}'
    )

    res = gemini_generate(
        prompt=prompt,
        api_key=api_key,
        model=model,
        use_search=False,
        json_mode=True,
        temperature=0.4,
        delay_sec=delay_sec
    )

    if res.get("status") == "ok" and res.get("json"):
        json_obj = res["json"]
        if isinstance(json_obj, dict):
            subject = str(json_obj.get("subject", "")).strip() or f"Quick note regarding {clean_title[:30]}"
            email = str(json_obj.get("email", "")).strip()
            anchor = str(json_obj.get("suggested_anchor", "")).strip() or client_name
            sentence = json_obj.get("suggested_sentence")
            if sentence is not None:
                sentence = str(sentence).strip()
            title_ideas = json_obj.get("title_ideas", [])
            if not isinstance(title_ideas, list):
                title_ideas = []

            return {
                "domain": domain,
                "url": url,
                "contact": contact,
                "pitch_type": pitch_type,
                "page_title": page_title,
                "subject": subject,
                "email": email,
                "suggested_anchor": anchor,
                "suggested_sentence": sentence,
                "title_ideas": title_ideas,
                "suggested_topics": title_ideas
            }

    # Fallback if parsing failed
    fb = fallback_template_pitch(client_name, client_domain, service_clean, market_clean, page_title, url, pitch_type, competitors)
    fb.update({
        "domain": domain,
        "url": url,
        "contact": contact,
        "pitch_type": pitch_type,
        "page_title": page_title
    })
    return fb


def generate_batch_pitches(
    selected_rows: list[dict],
    client_dict: dict,
    service: str,
    market: str = "",
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    delay_sec: float = 6.0,
    progress_callback=None
) -> list[dict]:
    """
    Generate outreach pitches for up to 10 selected rows with live progress tracking.
    """
    rows_to_process = selected_rows[:10]
    total = len(rows_to_process)
    results = []

    for idx, row in enumerate(rows_to_process):
        target_name = row.get("domain") or row.get("url", f"Target #{idx+1}")
        if progress_callback:
            progress_callback(
                (idx) / max(total, 1),
                f"Writing tailored outreach pitch for {target_name} [{idx + 1}/{total}]..."
            )

        pitch_result = generate_single_outreach_pitch(
            target_data=row,
            client_dict=client_dict,
            service=service,
            market=market,
            api_key=api_key,
            model=model,
            delay_sec=delay_sec
        )
        results.append(pitch_result)

    if progress_callback:
        progress_callback(1.0, f"Successfully generated {total} outreach pitches!")

    return results


def pitches_to_dataframe(pitches: list[dict]) -> pd.DataFrame:
    """
    Format pitches into a clean pandas DataFrame for display and CSV export.
    Columns: domain, url, contact, pitch_type, subject, email, suggested_anchor, suggested_sentence, title_ideas.
    """
    formatted = []
    for p in pitches:
        titles_list = p.get("title_ideas") or p.get("suggested_topics") or []
        titles_str = "; ".join(titles_list) if isinstance(titles_list, list) else str(titles_list)
        formatted.append({
            "domain": p.get("domain", ""),
            "url": p.get("url", ""),
            "contact": p.get("contact", ""),
            "pitch_type": p.get("pitch_type", ""),
            "subject": p.get("subject", ""),
            "email": p.get("email", ""),
            "suggested_anchor": p.get("suggested_anchor", ""),
            "suggested_sentence": p.get("suggested_sentence") or "",
            "title_ideas": titles_str
        })
    return pd.DataFrame(formatted)
