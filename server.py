"""
FastAPI Server for AI Citation & Link Building Prospector
Bridges the React/Vite SaaS frontend with the core AI prospecting, scoring,
brand position, content brief, and report generation engines.
"""

import os
import io
import json
import datetime
import pandas as pd
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gemini_client import (
    gemini_generate,
    normalize_model_name,
    get_session_calls_count
)
from app import (
    run_grounded_campaign_multi_market,
    analyse,
    parse_competitors,
    clean_url,
    root_domain,
    generate_prompts_gemini,
    DIRECTORY_DOMAINS,
    UGC_DOMAINS,
    IGNORE_DOMAINS,
    TEMPLATES,
    save_run,
    get_rate_limit_metrics
)
from page_analysis import (
    analyse_all_cited_pages,
    merge_page_analysis_into_domains
)
from brand_analysis import (
    analyze_all_records_brands,
    calculate_brand_position_summary
)
from pitch_generator import (
    generate_batch_pitches,
    pitches_to_dataframe
)
from content_brief import generate_content_brief
from client_report import export_excel_report, generate_html_report
from campaign_analytics import get_campaign_id, scan_all_campaign_runs

app = FastAPI(title="AI Citation Prospector API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RUNS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs")
os.makedirs(RUNS_DIR, exist_ok=True)


# ----------------------------------------------------------------------------
# Pydantic Request Models
# ----------------------------------------------------------------------------
class VerifyKeyRequest(BaseModel):
    api_key: str
    model: Optional[str] = "gemini-3.1-flash-lite"


class GeneratePromptsRequest(BaseModel):
    service: str
    location: str
    num_prompts: Optional[int] = 5
    api_key: Optional[str] = ""
    model: Optional[str] = "gemini-3.1-flash-lite"


class RunAuditRequest(BaseModel):
    client_name: str
    client_domain: str
    service: str
    markets: List[str]
    competitors: str
    prompts: List[str]
    repeats: Optional[int] = 1
    api_key: str
    model: Optional[str] = "gemini-3.1-flash-lite"
    delay_sec: Optional[float] = 0.0


class DeepAnalysisRequest(BaseModel):
    urls: List[str]
    client_name: str
    client_domain: str
    competitors: str


class GeneratePitchesRequest(BaseModel):
    targets: List[Dict[str, Any]]
    client_name: str
    client_domain: str
    service: str
    market: Optional[str] = "the UK"
    api_key: str
    model: Optional[str] = "gemini-3.1-flash-lite"


class GenerateBriefRequest(BaseModel):
    top_pages: List[Dict[str, Any]]
    client_name: str
    client_domain: str
    service: str
    market: Optional[str] = "the UK"
    api_key: str
    model: Optional[str] = "gemini-3.1-flash-lite"


class ExportReportRequest(BaseModel):
    run_payload: Dict[str, Any]
    table: List[Dict[str, Any]]
    gap_pages: Optional[List[Dict[str, Any]]] = []
    brand_summary: Optional[List[Dict[str, Any]]] = []
    pitches: Optional[List[Dict[str, Any]]] = []
    content_brief: Optional[Dict[str, Any]] = {}
    agency_name: Optional[str] = "Digital4Local"


# ----------------------------------------------------------------------------
# In-Memory Cache of the Latest Active Run
# ----------------------------------------------------------------------------
_LATEST_AUDIT_STATE = {
    "run": None,
    "table": [],
    "sov": [],
    "pages_df": [],
    "brand_results": [],
    "brand_summary": [],
    "content_brief": {},
    "pitches": []
}


# ----------------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------------
@app.get("/api/config")
def get_config():
    """Return environment status and default configuration."""
    env_key = os.getenv("GEMINI_API_KEY", "").strip()
    return {
        "has_env_key": bool(env_key),
        "env_key": env_key,
        "default_client_name": "Digital4Local",
        "default_client_domain": "digital4local.com",
        "default_service": "AI growth and local SEO agencies",
        "default_markets": ["the UK", "the US"],
        "default_competitors": "FatJoe | fatjoe.com\nSiege Media | siegemedia.com\nPage One Power | pageonepower.com",
        "default_model": "gemini-3.1-flash-lite",
        "available_models": [
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash-Lite (Recommended · Fast Free Tier)"},
            {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash (Deep Intelligence & Citations)"},
            {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash-Lite (Fast Multi-Market)"},
            {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash (Next-Gen)"}
        ]
    }


@app.post("/api/verify-key")
def verify_key(req: VerifyKeyRequest):
    """Test Gemini connection with given API Key."""
    key = req.api_key.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Please enter a Gemini API Key.")
    
    model = normalize_model_name(req.model)
    res = gemini_generate(prompt="ping", api_key=key, model=model, delay_sec=0.0)
    if res.get("status") == "ok":
        return {"status": "ok", "message": f"Connected to {res.get('model', model)} successfully!"}
    else:
        raise HTTPException(status_code=400, detail=res.get("error", "API Key validation failed."))


@app.post("/api/generate-prompts")
def generate_prompts(req: GeneratePromptsRequest):
    """Generate realistic buyer-intent queries for given service and market."""
    key = req.api_key.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    prompts = generate_prompts_gemini(
        service=req.service,
        location=req.location,
        n=req.num_prompts or 5,
        api_key=key,
        model=req.model or "gemini-3.1-flash-lite",
        delay_sec=0.0
    )
    return {"prompts": prompts}


@app.post("/api/run-audit")
def run_audit(req: RunAuditRequest):
    """Execute complete multi-market AI citation audit and compute scores."""
    key = req.api_key.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required to run the audit.")

    class ProgressCollector:
        def __init__(self):
            self.logs = []
        def progress(self, val):
            pass
        def text(self, msg):
            self.logs.append(msg)

    collector = ProgressCollector()
    competitors_list = parse_competitors(req.competitors)
    client_dict = {"name": req.client_name, "domain": req.client_domain}

    # Run queries across markets
    records = run_grounded_campaign_multi_market(
        prompts=req.prompts,
        markets=req.markets,
        repeats=req.repeats or 1,
        api_key=key,
        model=req.model or "gemini-3.1-flash-lite",
        delay_sec=req.delay_sec or 0.0,
        progress_bar=collector,
        status_text=collector
    )

    table_df, sov_df = analyse(records, client_dict, competitors_list, set(), req.repeats or 1)

    table_records = table_df.to_dict(orient="records") if not table_df.empty else []
    sov_records = sov_df.to_dict(orient="records") if not sov_df.empty else []

    # Collect all unique URLs cited across this run
    all_cited_urls = []
    for r in records:
        for u in r.get("urls", []):
            if u:
                all_cited_urls.append(u)
    unique_cited_urls = list(dict.fromkeys([clean_url(u) for u in all_cited_urls if u]))

    campaign_id = get_campaign_id(req.client_name, req.service, ", ".join(req.markets))

    run_payload = {
        "campaign_id": campaign_id,
        "created": datetime.datetime.now().isoformat(timespec="seconds"),
        "client": client_dict,
        "service": req.service,
        "markets": req.markets,
        "competitors": competitors_list,
        "prompts": req.prompts,
        "repeats": req.repeats,
        "model": req.model,
        "records": records,
    }

    try:
        saved_path = save_run(run_payload)
    except Exception:
        saved_path = ""

    # Calculate summary metrics
    total_answers = len([r for r in records if not r.get("error")])
    unique_domains_count = len(table_records)
    outreach_targets_count = sum(1 for t in table_records if str(t.get("action", "")).startswith("Outreach"))
    
    client_sov = 0.0
    if not sov_df.empty and req.client_name:
        c_row = sov_df[sov_df["brand"].str.lower() == req.client_name.strip().lower()]
        if not c_row.empty:
            client_sov = float(c_row["share_of_voice_pct"].iloc[0])

    avg_priority_score = round(float(table_df["priority_score"].mean()), 1) if not table_df.empty else 0.0

    # Auto-generate Competitor Gaps
    comp_names = [c["name"].strip() for c in competitors_list if c.get("name")]
    gap_queries = []
    for r in records:
        ans = r.get("answer", "")
        comps_here = [c for c in comp_names if c.lower() in ans.lower()]
        client_here = req.client_name.lower() in ans.lower()
        if comps_here and not client_here:
            gap_queries.append({
                "prompt": r.get("prompt"),
                "market": r.get("market"),
                "winning_competitors": comps_here,
                "cited_sources": r.get("urls", [])[:3]
            })

    # Save to in-memory state
    global _LATEST_AUDIT_STATE
    _LATEST_AUDIT_STATE["run"] = run_payload
    _LATEST_AUDIT_STATE["table"] = table_records
    _LATEST_AUDIT_STATE["sov"] = sov_records
    _LATEST_AUDIT_STATE["saved_path"] = saved_path

    return {
        "status": "ok",
        "campaign_id": campaign_id,
        "summary": {
            "total_answers": total_answers,
            "unique_domains": unique_domains_count,
            "outreach_targets": outreach_targets_count,
            "client_sov_pct": client_sov,
            "avg_priority_score": avg_priority_score,
            "total_queries_run": len(records),
            "unique_cited_urls_count": len(unique_cited_urls)
        },
        "table": table_records,
        "share_of_voice": sov_records,
        "unique_cited_urls": unique_cited_urls,
        "competitor_gaps": gap_queries,
        "records": records,
        "saved_path": saved_path
    }


@app.post("/api/deep-analysis")
def deep_analysis(req: DeepAnalysisRequest):
    """Scrape and analyze cited pages for competitor gaps and citation scores (0-100)."""
    client_dict = {"name": req.client_name, "domain": req.client_domain}
    competitors_list = parse_competitors(req.competitors)

    if not req.urls:
        return {"pages": [], "gap_pages_count": 0}

    class DummyProgress:
        pass

    pages_df = analyse_all_cited_pages(
        urls=req.urls,
        root_domain_fn=root_domain,
        clean_url_fn=clean_url,
        mentions_fn=lambda text, name: (name.lower() in text.lower()) if (text and name) else False,
        client=client_dict,
        competitors=competitors_list,
        directory_domains=DIRECTORY_DOMAINS,
        ugc_domains=UGC_DOMAINS,
        progress_callback=lambda p, msg: None
    )

    pages_records = pages_df.to_dict(orient="records") if not pages_df.empty else []
    gap_count = int(pages_df["competitor_gap"].sum()) if not pages_df.empty and "competitor_gap" in pages_df.columns else 0

    global _LATEST_AUDIT_STATE
    _LATEST_AUDIT_STATE["pages_df"] = pages_records

    return {
        "pages": pages_records,
        "gap_pages_count": gap_count
    }


@app.post("/api/generate-pitches")
def generate_pitches_endpoint(req: GeneratePitchesRequest):
    """Generate personalized outreach emails for selected targets."""
    key = req.api_key.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key required.")

    client_dict = {"name": req.client_name, "domain": req.client_domain}
    pitches = generate_batch_pitches(
        selected_rows=req.targets,
        client_dict=client_dict,
        service=req.service,
        market=req.market or "the UK",
        api_key=key,
        model=req.model or "gemini-3.1-flash-lite",
        delay_sec=0.0,
        progress_callback=lambda p, msg: None
    )

    global _LATEST_AUDIT_STATE
    _LATEST_AUDIT_STATE["pitches"] = pitches

    return {"pitches": pitches}


@app.post("/api/generate-brief")
def generate_brief_endpoint(req: GenerateBriefRequest):
    """Generate editorial content brief and 5 linkable assets."""
    key = req.api_key.strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key required.")

    client_dict = {"name": req.client_name, "domain": req.client_domain}
    brief = generate_content_brief(
        top_pages=req.top_pages,
        client_dict=client_dict,
        service=req.service,
        market=req.market or "the UK",
        api_key=key,
        model=req.model or "gemini-3.1-flash-lite",
        delay_sec=0.0
    )

    global _LATEST_AUDIT_STATE
    _LATEST_AUDIT_STATE["content_brief"] = brief

    return {"brief": brief}


@app.get("/api/runs")
def list_runs():
    """List all saved campaign runs."""
    campaigns = scan_all_campaign_runs(RUNS_DIR)
    return {"campaigns": campaigns}


@app.post("/api/export-excel")
def export_excel(req: ExportReportRequest):
    """Export multi-sheet white-label Excel deliverable."""
    table_df = pd.DataFrame(req.table) if req.table else pd.DataFrame()
    gap_pages_df = pd.DataFrame(req.gap_pages) if req.gap_pages else pd.DataFrame()
    brand_summary_df = pd.DataFrame(req.brand_summary) if req.brand_summary else pd.DataFrame()

    excel_bytes = export_excel_report(
        run_payload=req.run_payload,
        table_df=table_df,
        gap_pages_df=gap_pages_df,
        brand_summary_df=brand_summary_df,
        pitches_list=req.pitches or [],
        content_brief_data=req.content_brief or {},
        agency_name=req.agency_name or "Digital4Local"
    )

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ai_citation_report_{datetime.date.today().strftime('%Y%m%d')}.xlsx"}
    )


@app.post("/api/export-html")
def export_html(req: ExportReportRequest):
    """Export executive white-label HTML client report."""
    table_df = pd.DataFrame(req.table) if req.table else pd.DataFrame()
    gap_pages_df = pd.DataFrame(req.gap_pages) if req.gap_pages else pd.DataFrame()
    brand_summary_df = pd.DataFrame(req.brand_summary) if req.brand_summary else pd.DataFrame()

    html_str = generate_html_report(
        run_payload=req.run_payload,
        table_df=table_df,
        gap_pages_df=gap_pages_df,
        brand_summary_df=brand_summary_df,
        content_brief_data=req.content_brief or {},
        agency_name=req.agency_name or "Digital4Local"
    )

    return Response(
        content=html_str.encode("utf-8"),
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=ai_citation_report_{datetime.date.today().strftime('%Y%m%d')}.html"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
