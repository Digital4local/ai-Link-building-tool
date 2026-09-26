"""
AI Citation Link Prospector
Finds which websites AI answer engines (Perplexity, ChatGPT, Gemini, Claude) cite
for a niche, then turns them into a prioritised link-building / digital PR list.

Run:  streamlit run app.py
"""
import json
import os
import re
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import pandas as pd
import requests
import streamlit as st

# ----------------------------------------------------------------------------
# Domain helpers
# ----------------------------------------------------------------------------
UGC = {
    "reddit.com", "youtube.com", "quora.com", "facebook.com", "linkedin.com",
    "x.com", "twitter.com", "medium.com", "tiktok.com", "instagram.com",
    "wikipedia.org", "pinterest.com",
}
DIRECTORIES = {
    "yelp.com", "trustpilot.com", "clutch.co", "g2.com", "capterra.com",
    "goodfirms.co", "designrush.com", "upcity.com", "sortlist.com", "yell.com",
    "checkatrade.com", "justdial.com", "tripadvisor.com", "avvo.com",
    "findlaw.com", "justia.com", "martindale.com", "lawyers.com",
    "superlawyers.com", "chambers.com", "legal500.com", "bbb.org",
}
IGNORE = {"vertexaisearch.cloud.google.com", "google.com", "bing.com"}
SECOND_LEVEL = {"co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc"}


def root_domain(url_or_domain: str) -> str:
    s = (url_or_domain or "").strip().lower()
    if not s:
        return ""
    if "://" not in s:
        s = "https://" + s
    host = urlparse(s).netloc.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in SECOND_LEVEL and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def clean_url(url: str) -> str:
    """Strip tracking params such as utm_source=openai."""
    try:
        p = urlparse(url)
        q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith("utm_")]
        return urlunparse(p._replace(query=urlencode(q)))
    except Exception:
        return url


# ----------------------------------------------------------------------------
# Answer engines — each returns (answer_text, [cited_urls])
# ----------------------------------------------------------------------------
def ask_perplexity(prompt, key, model):
    r = requests.post(
        "https://api.perplexity.ai/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=120,
    )
    r.raise_for_status()
    d = r.json()
    urls = list(d.get("citations") or [])
    for s in d.get("search_results") or []:
        if s.get("url") and s["url"] not in urls:
            urls.append(s["url"])
    return d["choices"][0]["message"]["content"], urls


def ask_openai(prompt, key, model):
    def call(tool_type):
        return requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "tools": [{"type": tool_type}], "input": prompt},
            timeout=180,
        )

    r = call("web_search")
    if r.status_code == 400:  # older accounts/models only accept the preview tool
        r = call("web_search_preview")
    r.raise_for_status()
    d = r.json()
    text, urls = "", []
    for item in d.get("output", []):
        if item.get("type") != "message":
            continue
        for c in item.get("content", []):
            text += c.get("text", "") or ""
            for a in c.get("annotations") or []:
                if a.get("type") == "url_citation" and a.get("url"):
                    urls.append(a["url"])
    return text, urls


def ask_gemini(prompt, key, model):
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]},
        timeout=180,
    )
    r.raise_for_status()
    d = r.json()
    cand = (d.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
    urls = []
    for ch in (cand.get("groundingMetadata") or {}).get("groundingChunks") or []:
        web = ch.get("web") or {}
        title = (web.get("title") or "").strip()
        # Gemini returns redirect URIs; the title is normally the source domain
        if title and "." in title and " " not in title:
            urls.append("https://" + title)
        elif web.get("uri"):
            urls.append(web["uri"])
    return text, urls


def ask_claude(prompt, key, model):
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={
            "model": model, "max_tokens": 1500,
            "messages": [{"role": "user", "content": prompt}],
            "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        },
        timeout=180,
    )
    r.raise_for_status()
    text, urls = "", []
    for b in r.json().get("content", []):
        if b.get("type") == "text":
            text += b.get("text", "")
            for c in b.get("citations") or []:
                if c.get("url"):
                    urls.append(c["url"])
    return text, urls


ENGINES = {
    "Perplexity": (ask_perplexity, "PERPLEXITY_API_KEY", "sonar"),
    "ChatGPT": (ask_openai, "OPENAI_API_KEY", "gpt-4.1-mini"),
    "Gemini": (ask_gemini, "GEMINI_API_KEY", "gemini-2.5-flash"),
    "Claude": (ask_claude, "ANTHROPIC_API_KEY", "claude-haiku-4-5-20251001"),
}

# ----------------------------------------------------------------------------
# Prompt generation
# ----------------------------------------------------------------------------
TEMPLATES = [
    "What are the best {s} in {loc}?",
    "Top rated {s} in {loc} — who do people recommend?",
    "How do I choose between {s} in {loc}?",
    "Which {s} in {loc} have the best reviews?",
    "Who are the most trusted {s} in {loc} right now?",
    "Affordable but reliable {s} in {loc}?",
    "What questions should I ask {s} before hiring one in {loc}?",
    "Is it worth paying for {s}? Which ones are good in {loc}?",
    "Compare the leading {s} in {loc}",
    "Red flags to avoid when picking {s} in {loc}",
]


def generate_prompts(service, location, n, keys):
    instruction = (
        f"Write {n} realistic questions a buyer would type into ChatGPT or Perplexity "
        f"when looking for '{service}' in '{location}'. Mix 'best/top' lists, comparisons, "
        "how-to-choose, pricing and trust questions. Return ONLY a JSON array of strings."
    )
    try:
        if keys.get("Claude"):
            r = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": keys["Claude"], "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": ENGINES["Claude"][2], "max_tokens": 1500,
                      "messages": [{"role": "user", "content": instruction}]},
                timeout=60,
            )
            raw = "".join(b.get("text", "") for b in r.json().get("content", []))
        elif keys.get("ChatGPT"):
            r = requests.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {keys['ChatGPT']}",
                         "Content-Type": "application/json"},
                json={"model": ENGINES["ChatGPT"][2], "input": instruction},
                timeout=60,
            )
            raw = "".join(
                c.get("text", "") for i in r.json().get("output", [])
                if i.get("type") == "message" for c in i.get("content", [])
            )
        else:
            raise RuntimeError("no LLM key")
        raw = re.sub(r"```(json)?", "", raw).strip()
        prompts = json.loads(raw[raw.find("["): raw.rfind("]") + 1])
        return [p.strip() for p in prompts if isinstance(p, str) and p.strip()][:n]
    except Exception:
        return [t.format(s=service, loc=location) for t in TEMPLATES][:n]


# ----------------------------------------------------------------------------
# Run + analyse
# ----------------------------------------------------------------------------
def run_campaign(prompts, engines, keys, models, workers, progress=None):
    jobs = [(p, e) for p in prompts for e in engines]
    records, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(ENGINES[e][0], p, keys[e], models[e]): (p, e) for p, e in jobs
        }
        for f in as_completed(futures):
            p, e = futures[f]
            try:
                text, urls = f.result()
                records.append({"prompt": p, "engine": e, "answer": text,
                                "urls": [clean_url(u) for u in urls], "error": ""})
            except Exception as ex:
                records.append({"prompt": p, "engine": e, "answer": "", "urls": [],
                                "error": str(ex)[:300]})
            done += 1
            if progress:
                progress(done / len(jobs), f"{done}/{len(jobs)} answers collected")
    return records


def mentions(text, name):
    return bool(name) and re.search(r"\b" + re.escape(name.lower()) + r"\b", text.lower()) is not None


def analyse(records, client, competitors, inventory):
    client_root = root_domain(client.get("domain", ""))
    comp_roots = {root_domain(c["domain"]): c["name"] for c in competitors if c.get("domain")}
    rows = []
    for r in records:
        if r["error"]:
            continue
        brands_in_answer = [c["name"] for c in competitors if mentions(r["answer"], c["name"])]
        client_in_answer = mentions(r["answer"], client.get("name", ""))
        for u in dict.fromkeys(r["urls"]):
            d = root_domain(u)
            if not d or d in IGNORE:
                continue
            rows.append({
                "domain": d, "url": u, "engine": r["engine"], "prompt": r["prompt"],
                "competitor_only_answer": bool(brands_in_answer) and not client_in_answer,
            })
    if not rows:
        return pd.DataFrame(), pd.DataFrame()
    cites = pd.DataFrame(rows)

    def bucket(d):
        if d == client_root:
            return "Client's own site"
        if d in comp_roots:
            return f"Competitor site ({comp_roots[d]})"
        if d in UGC:
            return "Community / UGC — brand mention play"
        if d in DIRECTORIES:
            return "Directory / review — get listed"
        if d in inventory:
            return "In our network — pitch now"
        return "Outreach target — not in network"

    g = cites.groupby("domain")
    table = pd.DataFrame({
        "citations": g.size(),
        "engines": g["engine"].nunique(),
        "prompts": g["prompt"].nunique(),
        "cited_where_competitor_wins": g["competitor_only_answer"].sum(),
        "engine_list": g["engine"].apply(lambda s: ", ".join(sorted(set(s)))),
        "top_urls": g["url"].apply(lambda s: " | ".join(list(dict.fromkeys(s))[:3])),
    }).reset_index()
    table["action"] = table["domain"].apply(bucket)
    table["priority_score"] = (
        table["citations"] + 3 * table["engines"] + 2 * table["prompts"]
        + 2 * table["cited_where_competitor_wins"]
    )
    table = table.sort_values("priority_score", ascending=False).reset_index(drop=True)

    # Share of voice: % of answers per engine that name each brand
    ok = [r for r in records if not r["error"]]
    brands = ([client["name"]] if client.get("name") else []) + [c["name"] for c in competitors]
    sov = []
    for b in brands:
        row = {"brand": b}
        for e in sorted({r["engine"] for r in ok}):
            ans = [r for r in ok if r["engine"] == e]
            row[e] = round(100 * sum(mentions(r["answer"], b) for r in ans) / max(len(ans), 1))
        sov.append(row)
    return table, pd.DataFrame(sov)


def parse_competitors(text):
    out = []
    for line in text.splitlines():
        if not line.strip():
            continue
        name, _, dom = line.partition("|")
        out.append({"name": name.strip(), "domain": dom.strip()})
    return out


# ----------------------------------------------------------------------------
# UI
# ----------------------------------------------------------------------------
def main():
    st.set_page_config(page_title="AI Citation Link Prospector", page_icon="🔗", layout="wide")
    st.title("AI Citation Link Prospector")
    st.caption("Find the sites AI answer engines trust in a niche — and turn them into link targets.")

    with st.sidebar:
        st.subheader("Answer engines")
        keys, models, active = {}, {}, []
        for name, (_, env, default_model) in ENGINES.items():
            k = st.text_input(f"{name} API key", value=os.getenv(env, ""), type="password")
            models[name] = st.text_input(f"{name} model", value=default_model, key=f"m_{name}")
            keys[name] = k
            if k and st.checkbox(f"Use {name}", value=True, key=f"u_{name}"):
                active.append(name)
        workers = st.slider("Parallel requests", 1, 12, 6)
        st.divider()
        saved = st.file_uploader("Load a saved run (.json)", type="json")
        if saved:
            st.session_state.run = json.load(saved)

    c1, c2 = st.columns(2)
    with c1:
        client_name = st.text_input("Client brand name", "Digital Web Solutions")
        client_domain = st.text_input("Client domain", "digitalwebsolutions.com")
        service = st.text_input("Service / niche (plural, e.g. personal injury lawyers)", "link building agencies")
        location = st.text_input("Market", "the UK")
    with c2:
        comp_text = st.text_area(
            "Competitors (one per line: Brand | domain)", height=140,
            placeholder="Competitor One | competitorone.com\nCompetitor Two | competitortwo.com",
        )
        inv_file = st.file_uploader(
            "Publisher inventory CSV (optional — a 'domain' column or first column)", type="csv")

    inventory = set()
    if inv_file:
        df_inv = pd.read_csv(inv_file)
        col = "domain" if "domain" in df_inv.columns else df_inv.columns[0]
        inventory = {root_domain(str(x)) for x in df_inv[col].dropna()}
        st.caption(f"{len(inventory)} publisher domains loaded")

    st.subheader("Prompts")
    n = st.slider("How many prompts", 5, 40, 15)
    if st.button("Generate prompts"):
        with st.spinner("Writing buyer-style prompts…"):
            st.session_state.prompts = "\n".join(generate_prompts(service, location, n, keys))
    prompts_text = st.text_area("One prompt per line — edit freely", key="prompts", height=220)
    prompts = [p.strip() for p in prompts_text.splitlines() if p.strip()]

    if st.button("Run across AI engines", type="primary", disabled=not (prompts and active)):
        bar = st.progress(0.0, "Starting…")
        records = run_campaign(prompts, active, keys, models, workers,
                               lambda f, t: bar.progress(f, t))
        run = {
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "client": {"name": client_name, "domain": client_domain},
            "service": service, "location": location,
            "competitors": parse_competitors(comp_text),
            "records": records,
        }
        os.makedirs("runs", exist_ok=True)
        path = f"runs/{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
        with open(path, "w") as fh:
            json.dump(run, fh, indent=2)
        st.session_state.run = run
        st.success(f"Saved to {path}")
    if not active:
        st.info("Add at least one API key in the sidebar to run.")

    run = st.session_state.get("run")
    if not run:
        return

    records = run["records"]
    table, sov = analyse(records, run["client"], run["competitors"], inventory)
    errors = [r for r in records if r["error"]]

    st.divider()
    st.subheader(f"Results — {run['service']} in {run['location']}")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("AI answers", len(records) - len(errors))
    m2.metric("Unique domains cited", 0 if table.empty else len(table))
    m3.metric("Outreach targets", 0 if table.empty else int(
        table["action"].str.startswith("Outreach").sum()))
    if not sov.empty and run["client"].get("name"):
        client_row = sov[sov["brand"] == run["client"]["name"]].drop(columns="brand")
        m4.metric("Client share of voice", f"{int(client_row.mean(axis=1).iloc[0])}%")
    if errors:
        with st.expander(f"{len(errors)} requests failed"):
            st.dataframe(pd.DataFrame(errors)[["engine", "prompt", "error"]])

    if table.empty:
        st.warning("No citations came back. Check the keys and model names in the sidebar.")
        return

    tab1, tab2, tab3, tab4 = st.tabs(
        ["Link targets", "Share of voice", "Action mix", "Raw answers"])
    with tab1:
        actions = sorted(table["action"].unique())
        pick = st.multiselect("Filter by action", actions, default=actions)
        view = table[table["action"].isin(pick)]
        st.dataframe(view, use_container_width=True, hide_index=True)
        st.download_button("Download target list (CSV)", view.to_csv(index=False),
                           "ai_citation_targets.csv", "text/csv")
        st.bar_chart(table.head(15).set_index("domain")["citations"])
    with tab2:
        st.caption("% of answers from each engine that name the brand")
        st.dataframe(sov, use_container_width=True, hide_index=True)
    with tab3:
        st.bar_chart(table.groupby("action")["citations"].sum())
    with tab4:
        for r in records:
            if r["error"]:
                continue
            with st.expander(f"{r['engine']} — {r['prompt']}"):
                st.markdown(r["answer"])
                st.write(r["urls"])


if __name__ == "__main__":
    main()
