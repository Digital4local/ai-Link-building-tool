"""
Content Brief Generation Module
Analyzes top-performing AI-cited pages (titles, H2 headings, structure, and citation-worthiness scores)
and uses Gemini in JSON mode to synthesize a comprehensive editorial content brief:
- Common angles & narrative hooks across winning pages
- High-intent questions answered
- Data points & benchmark statistics used
- Recommended format & structure outline
- 5 high-authority linkable-asset / guest-post ideas engineered for AI citations
"""

import os
import re
import json
import pandas as pd
from gemini_client import gemini_generate


def get_brief_cache_path(run_payload: dict, file_path: str = "") -> str:
    """Generate standardized brief cache file path in runs/."""
    os.makedirs("runs", exist_ok=True)
    if file_path:
        base = os.path.basename(file_path)
        if base.startswith("pages_"):
            base = base[6:]
        if base.startswith("brands_"):
            base = base[7:]
        if base.startswith("brief_"):
            base = base[6:]
        if base.endswith(".json"):
            return os.path.join("runs", f"brief_{base}")
            
    created = run_payload.get("created", "") if isinstance(run_payload, dict) else ""
    if created:
        safe_ts = str(created).replace(":", "-")
        return os.path.join("runs", f"brief_{safe_ts}.json")
    return os.path.join("runs", "brief_cached.json")


def load_cached_brief(cache_path: str) -> dict:
    """Load cached content brief from disk if available."""
    if not cache_path or not os.path.exists(cache_path):
        return {}
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and "content_ideas" in data:
                return data
    except Exception:
        pass
    return {}


def save_cached_brief(brief_data: dict, cache_path: str) -> bool:
    """Save content brief data to cache JSON file."""
    if not cache_path or not brief_data:
        return False
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(brief_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def fallback_template_content_brief(client_name: str, service: str, market: str, top_pages: list[dict]) -> dict:
    """Fallback content brief when offline or without API key."""
    service_clean = service.capitalize() if service else "Link Building"
    market_clean = market if market else "the UK"

    sample_page_titles = [p.get("page_title") for p in top_pages if p.get("page_title")][:5]
    if not sample_page_titles:
        sample_page_titles = [f"Best {service_clean} in {market_clean}", f"Top Rated {service_clean} Guide"]

    return {
        "common_angles": [
          f"1. Vetted roundups comparing specialized {service_clean.lower()} capabilities vs full-service SEO agencies.",
          f"2. Transparent pricing breakdowns and average retainer benchmarks for {market_clean} businesses.",
          "3. Quality assurance and vetting frameworks (evaluating backlink compliance, spam risks, and domain authority thresholds)."
        ],
        "questions_answered": [
          f"What is the average cost of {service_clean.lower()} in {market_clean}?",
          "How do I choose between monthly retainers vs performance-based deliverables?",
          "What criteria differentiate Tier-1 digital PR outreach from automated link schemes?",
          "How long does it realistically take to measure organic traffic gains from acquired backlinks?",
          f"Which {service_clean.lower()} have verified client case studies and Clutch reviews?"
        ],
        "data_points_used": [
          "Average placement cost ranges (£150 - £600+ per Tier-1 contextual link)",
          "Domain Authority (DA 50+) and organic traffic volume (1,000+ monthly visits) minimums",
          "Average campaign timeline: 3 to 6 months to achieve significant SERP movement",
          "Survey data on client retention rates across top-performing agencies"
        ],
        "recommended_format": {
          "content_type": "Data-Driven Buyer Guide & Authority Benchmark Roundup",
          "recommended_word_count": "2,400 - 3,000 words",
          "structure_outline": [
            f"H1: The Definitive 2026 Guide to {service_clean} in {market_clean}",
            "H2: Key Selection Framework: 6 Criteria to Vet Before Hiring",
            "H2: Pricing & Retainer Benchmarks (Comparative Data Table)",
            f"H2: Top 10 Vetted {service_clean} Reviewed & Compared",
            "H2: Red Flags & Compliance Pitfalls to Avoid",
            "H2: Frequently Asked Questions (FAQ)"
          ],
          "visual_assets": "Interactive pricing comparison table, 6-point agency audit scorecard infographic, backlink velocity timeline diagram"
        },
        "content_ideas": [
          {
            "title": f"The 2026 {market_clean} {service_clean} Pricing & ROI Benchmark Report",
            "format": "Original Data Study & Benchmark Roundup",
            "why_ai_cites_it": "AI search engines heavily prioritize original survey data and exact pricing ranges when answering buyer cost queries.",
            "target_outreach_angle": "Pitch as an exclusive industry benchmark study to marketing publications, Clutch, and authority blogs."
          },
          {
            "title": f"5 Critical Red Flags When Hiring a {service_clean} in {market_clean}",
            "format": "Practical Teardown & Compliance Audit Guide",
            "why_ai_cites_it": "Answers high-intent buyer questions regarding vetting risks, bad practices, and vendor selection.",
            "target_outreach_angle": "Guest post submission for leading digital marketing blogs and business resource hubs."
          },
          {
            "title": f"Digital PR vs Niche Link Building: Which Drives Better AI Search Visibility in 2026?",
            "format": "Head-to-Head Comparative Study with Case Data",
            "why_ai_cites_it": "Directly satisfies 'X vs Y' comparative evaluation prompts frequently generated by prospective clients.",
            "target_outreach_angle": "Linkable asset with infographics and statistical takeaways."
          },
          {
            "title": "The Complete Agency Evaluation Checklist: 12 Questions to Ask in Your RFP",
            "format": "Downloadable Framework & Decision Matrix",
            "why_ai_cites_it": "Serves high buyer intent for selection criteria and RFP preparation questions.",
            "target_outreach_angle": "Resource page inclusion and partner co-marketing."
          },
          {
            "title": f"How High-Growth {market_clean} Brands Earn Tier-1 Press Links Without Paying for Placements",
            "format": "In-Depth Case Study & Campaign Teardown",
            "why_ai_cites_it": "Provides verifiable proof and brand examples that AI models cite as authoritative real-world evidence.",
            "target_outreach_angle": "Editorial pitches to business journals, industry podcasts, and SEO news portals."
          }
        ]
    }


def generate_content_brief(
    top_pages: list[dict],
    client_dict: dict,
    service: str,
    market: str,
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    delay_sec: float = 6.0
) -> dict:
    """
    Generate an AI-powered content brief based on the top 10 AI-cited pages using Gemini in JSON mode.
    """
    client_name = client_dict.get("name", "Our Brand").strip()
    service_clean = service or "Link Building"
    market_clean = market or "the UK"

    # Sort pages by citation_worthiness_score (descending) and select top 10
    sorted_pages = sorted(
        top_pages,
        key=lambda p: p.get("citation_worthiness_score", 0),
        reverse=True
    )[:10]

    if not api_key or not sorted_pages:
        return fallback_template_content_brief(client_name, service_clean, market_clean, sorted_pages)

    # Format page context summary
    pages_summary = []
    for idx, p in enumerate(sorted_pages):
        t = p.get("page_title", "")
        u = p.get("url", "")
        score = p.get("citation_worthiness_score", 50)
        headings = p.get("headings", [])
        h_str = " | ".join(headings[:6]) if headings else "No headings extracted"
        wc = p.get("word_count", 0)
        pages_summary.append(
            f"Page #{idx+1}:\n"
            f"- Title: {t}\n"
            f"- URL: {u}\n"
            f"- Citation-Worthiness Score: {score}/100 | Word Count: {wc}\n"
            f"- Key Headings: {h_str}\n"
        )

    pages_context_str = "\n".join(pages_summary)

    prompt = (
        "You are an elite SEO & AI Search Content Strategist. Analyze the following top-ranking pages that Google Gemini cited "
        f"when answering buyer and research queries for '{service_clean}' in '{market_clean}'.\n\n"
        "TOP 10 CITED PAGES CONTEXT:\n"
        f"{pages_context_str}\n\n"
        "TASK:\n"
        "Synthesize an actionable, high-authority content brief and linkable-asset plan that will outrank these competitors and earn direct AI citations.\n\n"
        "Return ONLY a JSON object matching this exact schema:\n"
        "{\n"
        '  "common_angles": [\n'
        '    "1. Recurring angle description...",\n'
        '    "2. ..."\n'
        '  ],\n'
        '  "questions_answered": [\n'
        '    "Question 1?",\n'
        '    "Question 2?"\n'
        '  ],\n'
        '  "data_points_used": [\n'
        '    "Data point / benchmark 1",\n'
        '    "Data point 2"\n'
        '  ],\n'
        '  "recommended_format": {\n'
        '    "content_type": "Format name",\n'
        '    "recommended_word_count": "2,200 - 2,800 words",\n'
        '    "structure_outline": [\n'
        '      "H1: ...",\n'
        '      "H2: ...",\n'
        '      "H2: ..."\n'
        '    ],\n'
        '    "visual_assets": "Description of tables, charts, or infographics to include"\n'
        '  },\n'
        '  "content_ideas": [\n'
        '    {\n'
        '      "title": "Title 1",\n'
        '      "format": "Original Data Study / Guide",\n'
        '      "why_ai_cites_it": "Reason AI models cite this format",\n'
        '      "target_outreach_angle": "How to pitch this asset to publishers"\n'
        '    }\n'
        '  ]\n'
        "}\n\n"
        "IMPORTANT: Provide exactly 5 distinct, high-authority 'content_ideas' engineered specifically to earn backlinks and AI search citations."
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
        if isinstance(json_obj, dict) and "content_ideas" in json_obj and isinstance(json_obj["content_ideas"], list):
            return json_obj

    return fallback_template_content_brief(client_name, service_clean, market_clean, sorted_pages)
