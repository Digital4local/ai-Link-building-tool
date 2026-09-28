"""
Page Analysis Module for AI Citation Link Prospector
Performs detailed on-page analysis of AI-cited target pages for outreach readiness:
- Title, H1, H2/H3 headings, word count, main content extraction
- Citation-Worthiness Score (0-100 rule-based scoring without API calls):
    * Freshness: last 6 months (+20), last 12 months (+10)
    * Statistics & data figures (+up to 15)
    * List structure (>=3 <li> or numbered headings) (+15)
    * FAQ headings or FAQPage schema (+15)
    * Schema markup (JSON-LD) (+10)
    * Depth: word_count >= 1000 (+15), >= 600 (+8)
    * Author attribution (+10)
- Links to client & competitor brand gap analysis
- Intelligent pitch type classification (List inclusion, Directory, Guest post, Niche edit)
- Contact & guest post write-for-us link discovery
- Date last updated (meta, JSON-LD, time tags)
- Outbound link counts & sponsored/nofollow %
- Domain-level roll-up merging & priority score boost
"""

import re
import json
import time
import datetime
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
import pandas as pd


CHROME_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

GUEST_POST_PATTERN = re.compile(
    r"write-for-us|guest-post|contribute|submit-article|become-a-contributor|submit-post|writers-wanted|write-for-our-blog",
    re.IGNORECASE
)

LIST_TITLE_PATTERN = re.compile(
    r"\b(best|top|\d+[\s\w])\b",
    re.IGNORECASE
)

DATE_PATTERN = re.compile(
    r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b"
)


# ----------------------------------------------------------------------------
# Page Fetching
# ----------------------------------------------------------------------------
def fetch_page(url: str, timeout: int = 10) -> tuple[str, int, str, str]:
    """
    Fetch a page with requests.
    Returns: (final_url, status_code, html_text, fetch_status)
    fetch_status is one of: 'ok', 'blocked', 'error'
    Never raises an exception.
    """
    clean_u = url.strip()
    if not clean_u.startswith("http://") and not clean_u.startswith("https://"):
        clean_u = "https://" + clean_u

    try:
        resp = requests.get(
            clean_u,
            headers=CHROME_HEADERS,
            timeout=timeout,
            allow_redirects=True,
            verify=True
        )
        final_url = resp.url
        status_code = resp.status_code

        # Check content type
        content_type = resp.headers.get("Content-Type", "").lower()
        if content_type and "text/html" not in content_type and "application/xhtml" not in content_type:
            return final_url, status_code, "", "error"

        if status_code == 200:
            text_sample = resp.text[:1000].lower()
            if "cf-browser-verification" in text_sample or "challenge-running" in text_sample or "just a moment..." in text_sample:
                return final_url, 403, resp.text, "blocked"
            return final_url, status_code, resp.text, "ok"
        elif status_code in (403, 401):
            return final_url, status_code, resp.text, "blocked"
        else:
            return final_url, status_code, "", "error"

    except requests.exceptions.SSLError:
        try:
            resp = requests.get(
                clean_u,
                headers=CHROME_HEADERS,
                timeout=timeout,
                allow_redirects=True,
                verify=False
            )
            if resp.status_code == 200:
                return resp.url, 200, resp.text, "ok"
            return resp.url, resp.status_code, "", "blocked" if resp.status_code in (403, 401) else "error"
        except Exception:
            return clean_u, 0, "", "error"
    except Exception:
        return clean_u, 0, "", "error"


# ----------------------------------------------------------------------------
# Metadata & Contact Extractors
# ----------------------------------------------------------------------------
def extract_last_updated(soup: BeautifulSoup, html: str) -> str:
    """Extract modified/published date from OpenGraph, meta tags, JSON-LD, or <time> tags."""
    if not soup:
        return ""

    # 1. Meta property="article:modified_time" or "article:published_time"
    for prop in ["article:modified_time", "article:published_time", "og:updated_time", "dateModified", "datePublished"]:
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            c = tag["content"].strip()
            date_match = re.search(r"\d{4}-\d{2}-\d{2}", c)
            if date_match:
                return date_match.group(0)

    # 2. JSON-LD structured data
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.string or "{}")
            items = data if isinstance(data, list) else (data.get("@graph", [data]) if isinstance(data, dict) else [])
            for item in items:
                if isinstance(item, dict):
                    for date_key in ["dateModified", "datePublished", "uploadDate"]:
                        if item.get(date_key):
                            d_str = str(item[date_key])
                            m = re.search(r"\d{4}-\d{2}-\d{2}", d_str)
                            if m:
                                return m.group(0)
        except Exception:
            continue

    # 3. <time datetime="...">
    time_tag = soup.find("time")
    if time_tag:
        dt = time_tag.get("datetime") or time_tag.get_text()
        if dt:
            m = re.search(r"\d{4}-\d{2}-\d{2}", dt)
            if m:
                return m.group(0)

    # 4. Regex search in meta or text
    meta_date = soup.find("meta", attrs={"name": "date"}) or soup.find("meta", attrs={"name": "last-modified"})
    if meta_date and meta_date.get("content"):
        m = re.search(r"\d{4}-\d{2}-\d{2}", meta_date["content"])
        if m:
            return m.group(0)

    return ""


def extract_contact_info(soup: BeautifulSoup, page_url: str, domain: str) -> str:
    """
    Extract contact info:
    1. First mailto: email on the page
    2. Raw email in text
    3. First contact page URL
    """
    if not soup:
        return ""

    # 1. Search for mailto: link
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.lower().startswith("mailto:"):
            email = href[7:].split("?")[0].strip()
            if email and "@" in email and "." in email:
                return email

    # 2. Search for raw email in text
    text = soup.get_text()
    emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", text)
    valid_emails = [e for e in emails if not e.endswith((".png", ".jpg", ".webp", ".svg", ".js", ".css"))]
    if valid_emails:
        return valid_emails[0]

    # 3. Look for contact link on page
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        link_text = (a.get_text() or "").lower()
        if "contact" in href.lower() or "contact" in link_text or "get-in-touch" in href.lower():
            if not href.startswith("mailto:") and not href.startswith("tel:"):
                resolved = urljoin(page_url, href)
                return resolved

    return ""


# ----------------------------------------------------------------------------
# Citation-Worthiness Score (Rule-based, 0-100)
# ----------------------------------------------------------------------------
def calculate_citation_worthiness_score(
    soup: BeautifulSoup,
    html: str,
    visible_text: str,
    last_updated_date: str,
    word_count: int,
    headings: list[str],
    main_container=None
) -> tuple[int, dict]:
    """
    Calculate 0-100 Citation-Worthiness Score:
    - Freshness: updated in last 6 months (+20), last 12 months (+10)
    - Statistics & Data: count of numbers with %, £/$, or study/survey/data (+up to 15)
    - List structure: >=3 <li> in main content or numbered H2/H3 (+15)
    - FAQ: FAQ heading or FAQPage JSON-LD (+15)
    - Schema: any JSON-LD present (+10)
    - Depth: word_count >= 1000 (+15), >= 600 (+8)
    - Author: author meta or byline (+10)
    Returns: (total_score_int, score_breakdown_dict)
    """
    if not html:
        return 0, {
            "freshness": 0, "statistics": 0, "list_structure": 0,
            "faq": 0, "schema": 0, "depth": 0, "author": 0, "total": 0
        }

    # 1. Freshness (+20 for <=6 months, +10 for <=12 months)
    freshness_score = 0
    if last_updated_date:
        try:
            # Handle YYYY-MM-DD
            d_parts = [int(p) for p in last_updated_date.split("-")[:3]]
            up_date = datetime.date(d_parts[0], d_parts[1], d_parts[2])
            ref_date = datetime.date(2026, 9, 28)
            diff_days = (ref_date - up_date).days
            if diff_days <= 185:
                freshness_score = 20
            elif diff_days <= 365:
                freshness_score = 10
        except Exception:
            freshness_score = 10  # Fallback if date is present but unparsed
    else:
        # If no explicit date tag, give standard baseline if current year appears in title/H1
        if "2026" in visible_text[:1000] or "2025" in visible_text[:1000]:
            freshness_score = 10

    # 2. Statistics & Data Proof Points (+up to 15)
    # Search for %, £/$, and data keywords
    pct_matches = re.findall(r'\b\d+(?:\.\d+)?%', visible_text)
    curr_matches = re.findall(r'[£$€]\s*\d+|\b\d+\s*(?:dollars|pounds|gbp|usd|eur)', visible_text, re.I)
    kw_matches = re.findall(r'\b(study|survey|dataset|benchmark|statistics|statistically|reported that|according to data)\b', visible_text, re.I)
    
    total_stat_points = len(pct_matches) + len(curr_matches) + len(kw_matches)
    statistics_score = min(15, total_stat_points * 3) if total_stat_points > 0 else 0

    # 3. List Structure (+15)
    list_score = 0
    li_count = 0
    if main_container:
        li_count = len(main_container.find_all("li"))
    elif soup:
        li_count = len(soup.find_all("li"))

    numbered_heading = any(re.search(r'^\d+[\.\)]\s|\b\d+\s+(best|top|ways|tips|steps|reasons|agencies|tools|methods|strategies)', h, re.I) for h in headings)

    if li_count >= 3 or numbered_heading:
        list_score = 15

    # 4. FAQ (+15)
    faq_score = 0
    faq_heading = any(re.search(r'\bfaq\b|\bfrequently asked\b|\bquestions\b', h, re.I) for h in headings)
    has_faq_jsonld = "FAQPage" in html or "Question" in html

    if faq_heading or has_faq_jsonld:
        faq_score = 15

    # 5. Schema Markup (+10)
    schema_score = 0
    if soup and soup.find("script", attrs={"type": "application/ld+json"}):
        schema_score = 10
    elif "application/ld+json" in html:
        schema_score = 10

    # 6. Depth (+15 for >=1000 words, +8 for >=600 words)
    depth_score = 0
    if word_count >= 1000:
        depth_score = 15
    elif word_count >= 600:
        depth_score = 8

    # 7. Author Attribution (+10)
    author_score = 0
    has_author_meta = bool(soup.find("meta", attrs={"name": re.compile(r"author", re.I)}) or soup.find("meta", attrs={"property": re.compile(r"author", re.I)}))
    has_author_tag = bool(soup.find(attrs={"class": re.compile(r"author|byline|written-by", re.I)}) or soup.find(attrs={"rel": "author"}))
    has_author_text = bool(re.search(r'\bwritten by\b|\bauthor:?\s+[a-z]+|\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+', visible_text[:1500]))

    if has_author_meta or has_author_tag or has_author_text:
        author_score = 10

    total_score = min(100, freshness_score + statistics_score + list_score + faq_score + schema_score + depth_score + author_score)

    breakdown = {
        "freshness": freshness_score,
        "statistics": statistics_score,
        "list_structure": list_score,
        "faq": faq_score,
        "schema": schema_score,
        "depth": depth_score,
        "author": author_score,
        "total": total_score
    }

    return total_score, breakdown


# ----------------------------------------------------------------------------
# On-Page Detailed Analysis
# ----------------------------------------------------------------------------
def analyse_single_page(
    url: str,
    root_domain_fn,
    clean_url_fn,
    mentions_fn,
    client: dict,
    competitors: list[dict],
    directory_domains: set[str],
    ugc_domains: set[str],
    domain_last_fetch: dict = None
) -> dict:
    """
    Fetch and analyze a single AI-cited URL.
    Returns a dictionary of all on-page fields + Citation-Worthiness Score + Headings.
    """
    clean_input_url = clean_url_fn(url)
    dom = root_domain_fn(clean_input_url)
    
    client_name = client.get("name", "").strip()
    client_domain = root_domain_fn(client.get("domain", ""))
    comp_names = [c["name"].strip() for c in competitors if c.get("name")]
    comp_roots = {root_domain_fn(c["domain"]): c["name"] for c in competitors if c.get("domain")}

    # Check UGC skip
    if dom in ugc_domains:
        return {
            "url": clean_input_url,
            "domain": dom,
            "page_title": f"{dom} (UGC / Community Platform)",
            "h1": "",
            "headings": [],
            "links_to_client": False,
            "competitors_present": [],
            "competitor_gap": False,
            "pitch_type": "Community / UGC",
            "guest_post_url": "",
            "contact": "",
            "last_updated": "",
            "outbound_links": 0,
            "sponsored_or_nofollow_share": 0.0,
            "word_count": 0,
            "citation_worthiness_score": 45,
            "citation_score_breakdown": {"total": 45},
            "fetch_status": "skipped_ugc"
        }

    # Respect 1-second pacing per domain
    if domain_last_fetch is not None and dom:
        last_t = domain_last_fetch.get(dom, 0)
        elapsed = time.time() - last_t
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        domain_last_fetch[dom] = time.time()

    final_url, status_code, html, fetch_status = fetch_page(clean_input_url, timeout=10)

    if fetch_status != "ok" or not html:
        return {
            "url": clean_input_url,
            "domain": dom,
            "page_title": "",
            "h1": "",
            "headings": [],
            "links_to_client": False,
            "competitors_present": [],
            "competitor_gap": False,
            "pitch_type": "Niche edit",
            "guest_post_url": "",
            "contact": "",
            "last_updated": "",
            "outbound_links": 0,
            "sponsored_or_nofollow_share": 0.0,
            "word_count": 0,
            "citation_worthiness_score": 30,
            "citation_score_breakdown": {"total": 30},
            "fetch_status": fetch_status
        }

    # Parse HTML with BeautifulSoup
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # 1. Page Title, H1, and Headings List
    title_tag = soup.find("title")
    page_title = title_tag.get_text().strip() if title_tag else ""
    h1_tag = soup.find("h1")
    h1_text = h1_tag.get_text().strip() if h1_tag else ""

    # Extract H2 and H3 headings for Content Briefs
    headings_list = []
    for h in soup.find_all(["h2", "h3"]):
        ht = h.get_text().strip()
        if ht and len(ht) > 3 and len(ht) < 150:
            tag_name = h.name.upper()
            headings_list.append(f"{tag_name}: {ht}")

    # Remove script, style, nav, footer for cleaner text analysis
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]):
        tag.decompose()

    # Identify main content container
    main_container = soup.find("article") or soup.find("main") or soup.find("div", attrs={"id": re.compile(r"content|main", re.I)}) or soup.find("body") or soup

    # 2. Links & Mentions Analysis
    all_links = soup.find_all("a", href=True)
    all_hrefs = [urljoin(final_url, a["href"]) for a in all_links]
    linked_domains = {root_domain_fn(h) for h in all_hrefs if h}

    visible_text = main_container.get_text(separator=" ", strip=True)
    full_page_text = soup.get_text(separator=" ", strip=True)

    # Links / mentions client
    client_linked = bool(client_domain and client_domain in linked_domains)
    client_named = bool(client_name and (mentions_fn(visible_text, client_name) or mentions_fn(full_page_text, client_name)))
    links_to_client = client_linked or client_named

    # Competitors present
    competitors_present = []
    for c_name in comp_names:
        if mentions_fn(visible_text, c_name) or mentions_fn(full_page_text, c_name):
            if c_name not in competitors_present:
                competitors_present.append(c_name)
    for c_dom, c_name in comp_roots.items():
        if c_dom and c_dom in linked_domains:
            if c_name not in competitors_present:
                competitors_present.append(c_name)

    # Competitor gap
    competitor_gap = bool(competitors_present) and not links_to_client

    # 3. Outbound links in main content & Sponsored / Nofollow share
    main_links = main_container.find_all("a", href=True)
    outbound_count = 0
    sponsored_nofollow_count = 0

    for a in main_links:
        h = a["href"].strip()
        if not h or h.startswith("#") or h.startswith("javascript:") or h.startswith("mailto:") or h.startswith("tel:"):
            continue
        resolved_h = urljoin(final_url, h)
        link_dom = root_domain_fn(resolved_h)
        if link_dom and link_dom != dom:
            outbound_count += 1
            rel_attr = a.get("rel") or []
            if isinstance(rel_attr, str):
                rel_attr = rel_attr.split()
            rel_lower = [str(r).lower() for r in rel_attr]
            if any(r in rel_lower for r in ["nofollow", "sponsored", "ugc"]):
                sponsored_nofollow_count += 1

    sponsored_nofollow_share = round((sponsored_nofollow_count / max(outbound_count, 1)) * 100, 1) if outbound_count > 0 else 0.0

    # 4. Word count of main content
    word_count = len(visible_text.split())

    # 5. Guest post URL detection
    guest_post_url = ""
    for h in all_hrefs:
        if GUEST_POST_PATTERN.search(h):
            guest_post_url = h
            break

    # 6. Contact extraction
    contact = extract_contact_info(soup, final_url, dom)

    if not contact or not guest_post_url:
        homepage_url = f"https://{dom}/"
        if homepage_url != final_url:
            hp_final, hp_status, hp_html, hp_fetch_status = fetch_page(homepage_url, timeout=8)
            if hp_fetch_status == "ok" and hp_html:
                try:
                    hp_soup = BeautifulSoup(hp_html, "lxml")
                except Exception:
                    hp_soup = BeautifulSoup(hp_html, "html.parser")

                if not contact:
                    contact = extract_contact_info(hp_soup, hp_final, dom)

                if not guest_post_url:
                    for a in hp_soup.find_all("a", href=True):
                        h = urljoin(hp_final, a["href"])
                        if GUEST_POST_PATTERN.search(h):
                            guest_post_url = h
                            break

    # 7. Last Updated date
    last_updated = extract_last_updated(soup, html)

    # 8. Pitch Type Classification (Rule-based)
    title_h1_combo = f"{page_title} {h1_text}"
    if LIST_TITLE_PATTERN.search(title_h1_combo):
        pitch_type = "List inclusion"
    elif dom in directory_domains:
        pitch_type = "Directory listing"
    elif guest_post_url:
        pitch_type = "Guest post"
    else:
        pitch_type = "Niche edit"

    # 9. Calculate Citation-Worthiness Score (0-100)
    citation_score, score_breakdown = calculate_citation_worthiness_score(
        soup=soup,
        html=html,
        visible_text=visible_text,
        last_updated_date=last_updated,
        word_count=word_count,
        headings=headings_list,
        main_container=main_container
    )

    main_text_excerpt = " ".join(visible_text.split())[:1500] if visible_text else ""

    return {
        "url": clean_input_url,
        "domain": dom,
        "page_title": page_title,
        "h1": h1_text,
        "headings": headings_list[:12],
        "links_to_client": links_to_client,
        "competitors_present": competitors_present,
        "competitor_gap": competitor_gap,
        "pitch_type": pitch_type,
        "guest_post_url": guest_post_url,
        "contact": contact,
        "last_updated": last_updated,
        "outbound_links": outbound_count,
        "sponsored_or_nofollow_share": sponsored_nofollow_share,
        "word_count": word_count,
        "citation_worthiness_score": citation_score,
        "citation_score_breakdown": score_breakdown,
        "main_text_excerpt": main_text_excerpt,
        "page_excerpt": main_text_excerpt,
        "fetch_status": "ok"
    }


# ----------------------------------------------------------------------------
# Batch Page Analysis Runner
# ----------------------------------------------------------------------------
def analyse_all_cited_pages(
    urls: list[str],
    root_domain_fn,
    clean_url_fn,
    mentions_fn,
    client: dict,
    competitors: list[dict],
    directory_domains: set[str],
    ugc_domains: set[str],
    progress_callback=None
) -> pd.DataFrame:
    """
    Run on-page analysis across a list of unique cited URLs with pacing and progress tracking.
    """
    unique_urls = list(dict.fromkeys([clean_url_fn(u) for u in urls if u]))
    total = len(unique_urls)
    results = []
    domain_last_fetch = {}

    start_time = time.time()
    for idx, u in enumerate(unique_urls):
        elapsed_total = time.time() - start_time
        avg_time = elapsed_total / max(idx, 1)
        remaining_sec = int(avg_time * (total - idx))

        if progress_callback:
            progress_callback(
                (idx) / max(total, 1),
                f"Analyzing page [{idx + 1}/{total}]: {u[:50]}... (~{remaining_sec}s remaining)"
            )

        try:
            row = analyse_single_page(
                url=u,
                root_domain_fn=root_domain_fn,
                clean_url_fn=clean_url_fn,
                mentions_fn=mentions_fn,
                client=client,
                competitors=competitors,
                directory_domains=directory_domains,
                ugc_domains=ugc_domains,
                domain_last_fetch=domain_last_fetch
            )
            results.append(row)
        except Exception:
            dom = root_domain_fn(u)
            results.append({
                "url": u,
                "domain": dom,
                "page_title": "",
                "h1": "",
                "headings": [],
                "links_to_client": False,
                "competitors_present": [],
                "competitor_gap": False,
                "pitch_type": "Niche edit",
                "guest_post_url": "",
                "contact": "",
                "last_updated": "",
                "outbound_links": 0,
                "sponsored_or_nofollow_share": 0.0,
                "word_count": 0,
                "citation_worthiness_score": 30,
                "citation_score_breakdown": {"total": 30},
                "fetch_status": "error"
            })

    if progress_callback:
        progress_callback(1.0, f"Completed analyzing all {total} cited pages!")

    return pd.DataFrame(results)


# ----------------------------------------------------------------------------
# Domain Roll-Up Merger
# ----------------------------------------------------------------------------
def merge_page_analysis_into_domains(domain_table: pd.DataFrame, pages_df: pd.DataFrame) -> pd.DataFrame:
    """
    Roll up page-level metrics into the domain target table:
    - competitor_gap_pages: count of pages with competitor gap
    - best_pitch_type: most frequent pitch type
    - contact: best contact found
    - guest_post_url: guest post url if found
    - newest_last_updated: latest date
    - citation_worthiness_score: mean citation-worthiness score for the domain
    - priority_score += 5 * competitor_gap_pages
    """
    if domain_table.empty:
        return domain_table

    if pages_df.empty:
        updated = domain_table.copy()
        for col in ["competitor_gap_pages", "best_pitch_type", "contact", "guest_post_url", "newest_last_updated", "citation_worthiness_score"]:
            if col not in updated.columns:
                updated[col] = 0 if col in ("competitor_gap_pages", "citation_worthiness_score") else ""
        return updated

    updated = domain_table.copy()

    rollup = {}
    for dom, group in pages_df.groupby("domain"):
        gap_count = int(group["competitor_gap"].sum())
        
        pitch_counts = group["pitch_type"].value_counts()
        best_pitch = pitch_counts.index[0] if not pitch_counts.empty else "Niche edit"

        contacts = [str(c).strip() for c in group["contact"] if str(c).strip()]
        best_contact = contacts[0] if contacts else ""

        gp_urls = [str(g).strip() for g in group["guest_post_url"] if str(g).strip()]
        best_gp = gp_urls[0] if gp_urls else ""

        dates = [str(d).strip() for d in group["last_updated"] if str(d).strip()]
        newest_date = sorted(dates, reverse=True)[0] if dates else ""

        # Mean citation worthiness score
        scores = group.get("citation_worthiness_score", pd.Series([50]))
        avg_score = int(scores.mean()) if not scores.empty else 50

        rollup[dom] = {
            "competitor_gap_pages": gap_count,
            "best_pitch_type": best_pitch,
            "contact": best_contact,
            "guest_post_url": best_gp,
            "newest_last_updated": newest_date,
            "citation_worthiness_score": avg_score
        }

    # Map rollup values to domain table
    updated["competitor_gap_pages"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("competitor_gap_pages", 0))
    updated["best_pitch_type"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("best_pitch_type", "Niche edit"))
    updated["contact"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("contact", ""))
    updated["guest_post_url"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("guest_post_url", ""))
    updated["newest_last_updated"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("newest_last_updated", ""))
    updated["citation_worthiness_score"] = updated["domain"].apply(lambda d: rollup.get(d, {}).get("citation_worthiness_score", 50))

    # Boost priority score: priority_score += 5 * competitor_gap_pages
    base_score = updated["priority_score"]
    updated["priority_score"] = round(base_score + (5.0 * updated["competitor_gap_pages"]), 1)

    updated = updated.sort_values(by=["priority_score", "citations"], ascending=[False, False]).reset_index(drop=True)
    return updated
