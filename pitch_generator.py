"""
Outreach Pitch Generator Module
Generates personalized, high-converting outreach emails for AI-cited prospect pages
and competitor gaps using Gemini in JSON mode:
- Tailored to pitch types: List inclusion, Guest post, Directory listing, Niche edit
- Enforces max 120 words, zero hype, and 1 clear actionable ask
- Generates subject lines, suggested anchor texts, and 3 guest post topic ideas
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
    page_title: str,
    url: str,
    pitch_type: str,
    competitors_present: list
) -> dict:
    """Intelligent rule-based fallback pitch if API is unavailable or offline."""
    clean_title = page_title or "your recent article"
    comp_str = ", ".join(competitors_present) if competitors_present else ""

    if pitch_type == "List inclusion":
        subject = f"Quick addition for {clean_title[:35]}"
        if comp_str:
            email = (
                f"Hi [Name],\n\n"
                f"I was reading your guide '{clean_title}' and noticed you featured great providers like {comp_str}. "
                f"Our team at {client_name} ({client_domain}) specialises in {service} with proven case studies in this exact space. "
                f"Would you be open to considering {client_name} for inclusion as an additional vetted resource for your readers?\n\n"
                f"Happy to send over a 2-sentence summary and stats to make updating it effortless.\n\n"
                f"Best,\n[Your Name]"
            )
        else:
            email = (
                f"Hi [Name],\n\n"
                f"Loved your roundup '{clean_title}'. We work with companies in {service} at {client_name} ({client_domain}) "
                f"and have recent client benchmark data that complements your list.\n\n"
                f"Would you be interested in adding {client_name} to the list to give your readers another strong option?\n\n"
                f"Best,\n[Your Name]"
            )
        anchor = f"{client_name} - {service}"
        topics = []

    elif pitch_type == "Guest post":
        subject = f"Guest contribution idea for {clean_title[:35]}"
        email = (
            f"Hi [Name],\n\n"
            f"I really enjoyed your article '{clean_title}' and noticed you accept expert contributions. "
            f"As specialists in {service} at {client_name} ({client_domain}), I've put together three data-backed topic ideas "
            f"tailored to your audience with zero promotional fluff.\n\n"
            f"Would you like me to share a detailed outline for any of the proposed topics below?\n\n"
            f"Best,\n[Your Name]"
        )
        anchor = f"{service} insights from {client_name}"
        topics = [
            f"How Modern {service.capitalize()} Drives Sustainable Organic Growth in 2026",
            f"5 Overlooked Traps to Avoid When Hiring {service.capitalize()}",
            f"A Practical Data-Driven Guide to Vetting {service.capitalize()}"
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
        topics = []

    else:  # Niche edit / contextual link
        subject = f"Quick resource suggestion for {clean_title[:35]}"
        email = (
            f"Hi [Name],\n\n"
            f"Came across your piece on '{clean_title}' while researching {service}. "
            f"We recently published an in-depth breakdown on this exact topic over at {client_domain} "
            f"that provides actionable data for your readers.\n\n"
            f"Would you consider referencing it as a helpful resource in your article?\n\n"
            f"Cheers,\n[Your Name]"
        )
        anchor = f"{client_name}'s guide to {service}"
        topics = []

    return {
        "subject": subject,
        "email": email,
        "suggested_anchor": anchor,
        "suggested_topics": topics
    }


def generate_single_outreach_pitch(
    target_data: dict,
    client_dict: dict,
    service: str,
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
    excerpt = target_data.get("page_excerpt", "")
    if not excerpt and url:
        excerpt = extract_page_text_excerpt(url, max_chars=1500)

    if not api_key:
        fallback = fallback_template_pitch(client_name, client_domain, service_clean, page_title, url, pitch_type, competitors)
        fallback.update({
            "domain": domain,
            "url": url,
            "contact": contact,
            "pitch_type": pitch_type,
            "page_title": page_title
        })
        return fallback

    comp_context = f"Competitors mentioned on page: {', '.join(competitors)}" if competitors else "No competitor brands detected on page."

    prompt = (
        "You are an elite Digital PR and SEO outreach specialist. Write a high-converting, personalized outreach pitch.\n\n"
        "CAMPAIGN DETAILS:\n"
        f"- Client Brand: {client_name}\n"
        f"- Client Domain: {client_domain}\n"
        f"- Service / Niche: {service_clean}\n\n"
        "TARGET PAGE DETAILS:\n"
        f"- Target URL: {url}\n"
        f"- Target Domain: {domain}\n"
        f"- Page Title: {page_title}\n"
        f"- Pitch Strategy: {pitch_type}\n"
        f"- {comp_context}\n"
        f"- Page Content Snippet (1,500 chars max):\n"
        f'"""\n{excerpt[:1500] if excerpt else page_title}\n"""\n\n'
        "STRICT WRITING RULES:\n"
        "1. 'subject': Punchy, personalized subject line under 8 words. Reference the article title or specific topic naturally.\n"
        "2. 'email': Outreach message under 120 words. Open with a genuine, specific compliment referencing the page snippet. "
        f"Match the ask directly to the pitch type ('{pitch_type}'). "
        "Keep it concise, friendly, and respectful. Use [Name] as recipient placeholder. Zero hype or generic buzzwords.\n"
        f"3. 'suggested_anchor': Natural, context-appropriate anchor text to link to {client_name} ({client_domain}).\n"
        "4. 'suggested_topics': If and ONLY IF pitch_type is 'Guest post', provide an array of exactly 3 compelling, data-driven article title ideas. "
        "For all other pitch types (List inclusion, Directory listing, Niche edit), return an empty array [].\n\n"
        "Return ONLY a JSON object matching this schema:\n"
        "{\n"
        '  "subject": "Quick resource addition for...",\n'
        '  "email": "Hi [Name],\\n\\n...",\n'
        '  "suggested_anchor": "...",\n'
        '  "suggested_topics": ["Title 1", "Title 2", "Title 3"]\n'
        "}"
    )

    res = gemini_generate(
        prompt=prompt,
        api_key=api_key,
        model=model,
        use_search=False,
        json_mode=True,
        temperature=0.6,
        delay_sec=delay_sec
    )

    if res.get("status") == "ok" and res.get("json"):
        json_obj = res["json"]
        if isinstance(json_obj, dict):
            subject = str(json_obj.get("subject", "")).strip() or f"Resource idea for {domain}"
            email = str(json_obj.get("email", "")).strip()
            anchor = str(json_obj.get("suggested_anchor", "")).strip() or client_name
            topics = json_obj.get("suggested_topics", [])
            if not isinstance(topics, list):
                topics = []

            return {
                "domain": domain,
                "url": url,
                "contact": contact,
                "pitch_type": pitch_type,
                "page_title": page_title,
                "subject": subject,
                "email": email,
                "suggested_anchor": anchor,
                "suggested_topics": topics
            }

    # Fallback if parsing failed
    fb = fallback_template_pitch(client_name, client_domain, service_clean, page_title, url, pitch_type, competitors)
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
            api_key=api_key,
            model=model,
            delay_sec=delay_sec
        )
        results.append(pitch_result)

    if progress_callback:
        progress_callback(1.0, f"Successfully generated {total} outreach pitches!")

    return results


def pitches_to_dataframe(pitches: list[dict]) -> pd.DataFrame:
    """Format pitches into a clean pandas DataFrame for display and CSV export."""
    formatted = []
    for p in pitches:
        topics_str = "; ".join(p.get("suggested_topics", [])) if p.get("suggested_topics") else ""
        formatted.append({
            "domain": p.get("domain", ""),
            "url": p.get("url", ""),
            "contact": p.get("contact", ""),
            "pitch_type": p.get("pitch_type", ""),
            "subject": p.get("subject", ""),
            "email": p.get("email", ""),
            "suggested_anchor": p.get("suggested_anchor", ""),
            "suggested_topics": topics_str
        })
    return pd.DataFrame(formatted)
