"""
Campaign Analytics & Multi-Market Intelligence Module
Handles:
- Campaign ID slug generation and run grouping
- Multi-run trend comparisons (Share of Voice over time, average position deltas, domain churn)
- "Won links now cited" attribution against built-link CSV uploads
- Multi-market cross-analysis (Domain x Market heatmaps, Geo-specific targets, Market SoV)
"""

import os
import re
import glob
import json
import pandas as pd
from urllib.parse import urlparse

from brand_analysis import calculate_brand_position_summary, load_cached_brands, get_brand_cache_path


SECOND_LEVEL_TLDS = {
    "co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc",
    "me", "gen", "asso", "biz", "info", "ne", "in", "or", "go"
}


def slugify(text: str) -> str:
    """Generate clean URL/filesystem friendly slug."""
    s = str(text or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return s.strip("-")


def get_campaign_id(client_name: str, service: str, market_or_markets: str) -> str:
    """Compute standardized campaign_id from client name, service, and market."""
    c_name = slugify(client_name or "client")
    c_serv = slugify(service or "service")
    c_mkt = slugify(market_or_markets or "global")
    return f"{c_name}-{c_serv}-{c_mkt}"


def root_domain_clean(url_or_domain: str) -> str:
    """Extract canonical root domain."""
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


def mentions_word(text: str, name: str) -> bool:
    """Word boundary brand match."""
    if not name or not text:
        return False
    pattern = r"(?<!\w)" + re.escape(name.strip().lower()) + r"(?!\w)"
    return re.search(pattern, text.lower()) is not None


# ----------------------------------------------------------------------------
# Campaign History Scanner
# ----------------------------------------------------------------------------
def scan_all_campaign_runs(runs_dir: str = "runs") -> dict[str, list[dict]]:
    """
    Scan all saved run JSON files in runs/ and group them by campaign_id.
    Returns: dict { campaign_id: [run_summary_dict, ... sorted by created asc] }
    """
    if not os.path.exists(runs_dir):
        return {}

    run_files = glob.glob(os.path.join(runs_dir, "*.json"))
    valid_runs = []

    for fpath in run_files:
        fname = os.path.basename(fpath)
        # Skip cache files
        if fname.startswith("pages_") or fname.startswith("brands_"):
            continue

        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if not isinstance(data, dict) or "records" not in data:
                continue

            client = data.get("client", {})
            c_name = client.get("name", "") if isinstance(client, dict) else ""
            c_dom = client.get("domain", "") if isinstance(client, dict) else ""
            service = data.get("service", "")
            location = data.get("location", "")
            markets = data.get("markets", [location] if location else ["Global"])
            if isinstance(markets, str):
                markets = [m.strip() for m in markets.split(",") if m.strip()]

            mkt_str = ", ".join(markets)
            campaign_id = data.get("campaign_id") or get_campaign_id(c_name, service, mkt_str)
            created = data.get("created", "2026-01-01T00:00:00")

            valid_runs.append({
                "filepath": fpath,
                "filename": fname,
                "campaign_id": campaign_id,
                "created": created,
                "client_name": c_name,
                "client_domain": c_dom,
                "service": service,
                "location": location,
                "markets": markets,
                "records_count": len(data.get("records", [])),
                "total_tokens": data.get("total_tokens", 0),
                "data": data
            })
        except Exception:
            continue

    # Group by campaign_id
    grouped = {}
    for r in valid_runs:
        cid = r["campaign_id"]
        if cid not in grouped:
            grouped[cid] = []
        grouped[cid].append(r)

    # Sort each campaign's runs by creation date ascending
    for cid in grouped:
        grouped[cid].sort(key=lambda x: str(x.get("created", "")))

    return grouped


# ----------------------------------------------------------------------------
# Multi-Run Trend & Delta Comparisons
# ----------------------------------------------------------------------------
def compute_run_metrics(run_data: dict) -> dict:
    """Compute brand SoV, client avg position, and cited domains for a single run."""
    client = run_data.get("client", {})
    client_name = client.get("name", "").strip() if isinstance(client, dict) else ""
    competitors = run_data.get("competitors", [])
    comp_names = [c["name"].strip() for c in competitors if isinstance(c, dict) and c.get("name")]
    records = run_data.get("records", [])
    valid_records = [r for r in records if not r.get("error") and r.get("answer")]
    total_valid = max(len(valid_records), 1)

    # All brands list
    all_brands = []
    if client_name:
        all_brands.append(client_name)
    for c in comp_names:
        if c not in all_brands:
            all_brands.append(c)

    # Share of Voice %
    sov_dict = {}
    for b in all_brands:
        mentions = sum(1 for r in valid_records if mentions_word(r.get("answer", ""), b))
        sov_dict[b] = round((mentions / total_valid) * 100, 1)

    # Domain citations
    domains = set()
    domain_citation_counts = {}
    for r in valid_records:
        for u in r.get("urls", []):
            d = root_domain_clean(u)
            if d:
                domains.add(d)
                domain_citation_counts[d] = domain_citation_counts.get(d, 0) + 1

    return {
        "created": run_data.get("created", ""),
        "total_valid_answers": total_valid,
        "all_brands": all_brands,
        "sov": sov_dict,
        "domains": domains,
        "domain_counts": domain_citation_counts
    }


def compare_two_runs(
    earlier_run_data: dict,
    latest_run_data: dict,
    won_links_urls: list[str] = None
) -> dict:
    """
    Compare an earlier baseline run with a latest run:
    - Share of voice delta
    - Domain churn: new domains, lost domains, stable domains
    - Won links attribution
    - Summary narrative sentence
    """
    m_earlier = compute_run_metrics(earlier_run_data)
    m_latest = compute_run_metrics(latest_run_data)

    client_name = latest_run_data.get("client", {}).get("name", "Client")
    
    c_sov_earlier = m_earlier["sov"].get(client_name, 0.0)
    c_sov_latest = m_latest["sov"].get(client_name, 0.0)
    c_sov_delta = round(c_sov_latest - c_sov_earlier, 1)

    d_earlier = m_earlier["domains"]
    d_latest = m_latest["domains"]

    new_domains = sorted(list(d_latest - d_earlier))
    lost_domains = sorted(list(d_earlier - d_latest))
    stable_domains = sorted(list(d_latest & d_earlier))

    # Won links analysis
    won_domains_cited = []
    won_urls_cleaned = [u.strip() for u in (won_links_urls or []) if u and str(u).strip()]
    won_domain_map = {}
    for u in won_urls_cleaned:
        rd = root_domain_clean(u)
        if rd:
            won_domain_map[rd] = u

    if won_domain_map:
        for rd, orig_url in won_domain_map.items():
            is_cited_latest = rd in d_latest
            is_cited_earlier = rd in d_earlier
            won_domains_cited.append({
                "domain": rd,
                "won_url": orig_url,
                "cited_in_latest": is_cited_latest,
                "cited_in_earlier": is_cited_earlier,
                "latest_citations": m_latest["domain_counts"].get(rd, 0),
                "status": "🎯 Newly Cited!" if (is_cited_latest and not is_cited_earlier) else ("✅ Retained Citation" if is_cited_latest else "❌ Not Yet Cited")
            })

    won_cited_count = sum(1 for w in won_domains_cited if w["cited_in_latest"])

    # Construct top summary sentence
    sov_sign = "+" if c_sov_delta > 0 else ""
    summary_sentence = (
        f"Client Share of Voice moved from {c_sov_earlier}% to {c_sov_latest}% ({sov_sign}{c_sov_delta}%); "
        f"{len(new_domains)} new domains cited; {len(lost_domains)} dropped; "
        f"{won_cited_count} won-link domains now actively cited by Gemini."
    )

    return {
        "client_name": client_name,
        "earlier_date": m_earlier["created"],
        "latest_date": m_latest["created"],
        "client_sov_earlier": c_sov_earlier,
        "client_sov_latest": c_sov_latest,
        "client_sov_delta": c_sov_delta,
        "new_domains": new_domains,
        "lost_domains": lost_domains,
        "stable_domains": stable_domains,
        "won_links_analysis": pd.DataFrame(won_domains_cited) if won_domains_cited else pd.DataFrame(),
        "won_cited_count": won_cited_count,
        "summary_sentence": summary_sentence
    }


def compute_multi_run_sov_trend_series(campaign_runs: list[dict]) -> pd.DataFrame:
    """
    Build a time-series DataFrame of Brand Share of Voice (%) across all runs in a campaign.
    Columns: ['Run Date', Brand 1, Brand 2, ...]
    """
    if not campaign_runs:
        return pd.DataFrame()

    trend_rows = []
    for r in campaign_runs:
        run_data = r.get("data", {})
        m = compute_run_metrics(run_data)
        date_str = str(m["created"])[:16].replace("T", " ") or r.get("filename", "")
        
        row_entry = {"Run Date": date_str}
        for b, val in m["sov"].items():
            row_entry[b] = val
        trend_rows.append(row_entry)

    df_trend = pd.DataFrame(trend_rows)
    if not df_trend.empty and "Run Date" in df_trend.columns:
        df_trend = df_trend.set_index("Run Date")
    return df_trend


# ----------------------------------------------------------------------------
# Multi-Market Analysis
# ----------------------------------------------------------------------------
def analyze_multi_market_run(records: list[dict], client_dict: dict, competitors: list[dict]) -> dict:
    """
    Perform deep cross-market analysis:
    - Domain x Market Citation Heatmap Matrix
    - Brand Share of Voice per Market
    - Geo-Specific (single market) vs Global Multi-Market Authority Domains
    """
    client_name = client_dict.get("name", "").strip() if isinstance(client_dict, dict) else ""
    comp_names = [c["name"].strip() for c in competitors if isinstance(c, dict) and c.get("name")]
    all_brands = [client_name] + [c for c in comp_names if c != client_name]

    # Detect all distinct markets present in records
    market_domain_counts = {}  # { (domain, market): count }
    market_valid_counts = {}   # { market: total_valid_answers }
    market_brand_mentions = {} # { (brand, market): count }
    all_domains = set()
    all_markets = []

    for r in records:
        if r.get("error"):
            continue

        # Extract market tag from record (or prompt text)
        market = r.get("market") or "Global"
        if market not in all_markets:
            all_markets.append(market)

        market_valid_counts[market] = market_valid_counts.get(market, 0) + 1
        ans_text = r.get("answer", "")

        for b in all_brands:
            if mentions_word(ans_text, b):
                key = (b, market)
                market_brand_mentions[key] = market_brand_mentions.get(key, 0) + 1

        for u in r.get("urls", []):
            d = root_domain_clean(u)
            if d:
                all_domains.add(d)
                key = (d, market)
                market_domain_counts[key] = market_domain_counts.get(key, 0) + 1

    if not all_markets:
        all_markets = ["Global"]

    # 1. Domain x Market Citation Heatmap DataFrame
    matrix_rows = []
    for d in all_domains:
        row = {"domain": d}
        tot = 0
        markets_present = 0
        for m in all_markets:
            c = market_domain_counts.get((d, m), 0)
            row[m] = c
            tot += c
            if c > 0:
                markets_present += 1
        row["Total Citations"] = tot
        row["Markets Cited In"] = markets_present
        matrix_rows.append(row)

    df_heatmap = pd.DataFrame(matrix_rows)
    if not df_heatmap.empty:
        df_heatmap = df_heatmap.sort_values(by=["Total Citations", "Markets Cited In"], ascending=[False, False]).reset_index(drop=True)

    # 2. Brand Share of Voice per Market
    sov_market_rows = []
    for b in all_brands:
        row = {"Brand": b}
        for m in all_markets:
            total_mkt = max(market_valid_counts.get(m, 1), 1)
            b_cnt = market_brand_mentions.get((b, m), 0)
            row[f"{m} SoV %"] = round((b_cnt / total_mkt) * 100, 1)
        sov_market_rows.append(row)

    df_market_sov = pd.DataFrame(sov_market_rows)

    # 3. Single-Market (Geo-Specific) vs Global Domains
    single_market_domains = []
    global_authority_domains = []

    if not df_heatmap.empty:
        for _, r in df_heatmap.iterrows():
            d = r["domain"]
            m_count = r["Markets Cited In"]
            if m_count == 1:
                # Find which market it belongs to
                single_mkt = [m for m in all_markets if r[m] > 0][0]
                single_market_domains.append({
                    "domain": d,
                    "market": single_mkt,
                    "citations": r[single_mkt]
                })
            elif m_count == len(all_markets) and len(all_markets) > 1:
                global_authority_domains.append({
                    "domain": d,
                    "total_citations": r["Total Citations"],
                    "all_markets_cited": ", ".join(all_markets)
                })

    df_single_market = pd.DataFrame(single_market_domains)
    if not df_single_market.empty:
        df_single_market = df_single_market.sort_values(by=["market", "citations"], ascending=[True, False]).reset_index(drop=True)

    df_global = pd.DataFrame(global_authority_domains)
    if not df_global.empty:
        df_global = df_global.sort_values(by="total_citations", ascending=False).reset_index(drop=True)

    return {
        "all_markets": all_markets,
        "heatmap_df": df_heatmap,
        "market_sov_df": df_market_sov,
        "single_market_df": df_single_market,
        "global_domains_df": df_global
    }


def parse_won_links_file(file_obj) -> list[str]:
    """Parse an uploaded CSV file containing built links (column 'url' or first column)."""
    if file_obj is None:
        return []
    try:
        df = pd.read_csv(file_obj)
        col = "url" if "url" in df.columns else ("URL" if "URL" in df.columns else df.columns[0])
        return [str(u).strip() for u in df[col].dropna() if str(u).strip().startswith("http")]
    except Exception:
        return []
