# 🎯 AI Citation Link Prospector

**AI Citation Link Prospector** is a specialised SEO & Digital PR intelligence tool designed to reverse-engineer Google Gemini's AI citations (via Google Search Grounding) for any niche and geographic market.

It identifies the exact websites Gemini cites when answering high-intent buyer and research queries, categorises them, scrapes and analyses each cited page, and calculates actionable **Priority Link-Building & Outreach Scores**.

---

## 🌟 Key Features

- **Gemini-First Search Grounding & Citation Fallback**:
  - Direct REST API integration with Gemini models (`gemini-3.1-flash-lite`, `gemini-2.5-flash`, etc.) using Google Search tools (`google_search`).
  - Seamless AI citation parsing fallback to guarantee zero failures on free-tier keys.
- **Deep On-Page Analysis & Outreach Intelligence**:
  - Scrapes each AI-cited URL with 1-second domain pacing and Chrome user-agent headers.
  - Skips UGC domains (Reddit, YouTube, Quora, Wikipedia, LinkedIn, Medium, Facebook, X/Twitter, etc.).
  - Extracts **Page Title**, **H1**, and main content **Word Count**.
  - Checks if the page links to or mentions your client brand.
  - Detects **Competitors Present** and flags high-priority **Competitor Gaps** (where competitors are featured but your brand is omitted).
  - Rule-based **Pitch Type Classification**:
    - *"List inclusion"* (Top/Best lists)
    - *"Directory listing"* (Clutch, G2, Trustpilot, etc.)
    - *"Guest post"* (Detects Write-For-Us/Contribute links on page or homepage)
    - *"Niche edit"*
  - **Contact & Email Discovery**: Discovers `mailto:` emails from the page/homepage or contact page URLs.
  - **Freshness Detection**: Extracts `last_updated` date from OpenGraph, JSON-LD schemas (`dateModified`/`datePublished`), or `<time>` tags.
  - **Outbound Link Profiling**: Counts external links and calculates `% Sponsored / Nofollow` share.
- **Domain-Level Roll-Up & Enhanced Priority Scoring**:
  - Aggregates page analysis into the domain target table: `competitor_gap_pages`, `best_pitch_type`, `contact`, `guest_post_url`, `newest_last_updated`.
  - **Boosted Priority Score Formula**:
    $$\text{Priority Score} = \text{Citations} + (2 \times \text{Prompts}) + (2 \times \text{Competitor Wins}) + \frac{\text{Consistency \%}}{25} + (5 \times \text{Competitor Gap Pages})$$
- **Free-Tier Rate Limiting Safety**:
  - Sequential requests with configurable pacing delay (default: 6.0 seconds).
  - Automatic exponential retry on HTTP 429 (`ResourceExhausted`), waiting 20 seconds up to 3 times before failing safely.
  - Transparent error logging without application crashes.
- **Dedicated Interactive Tabs**:
  - 🎯 **Link Targets**: Prioritised domain outreach list with action & pitch type filters, contact info, and CSV download.
  - ⚔️ **Competitor Gaps**: Dedicated outreach table of exact URLs featuring competitors without your brand, with direct CSV export.
  - 📢 **Share of Voice**: Brand mention comparison and SoV % metrics.
  - 📊 **Action Mix**: Visual distribution of target categories.
  - 📝 **Raw Answers & Citations**: Complete grounding queries, AI answers, and source citations.
  - ⚡ **Token & Quota Monitor**: Per-query token breakdown, live RPM/RPD meters, and cost estimation.
- **Run & Page Analysis Cache Persistence**:
  - Every run is automatically saved to `runs/<timestamp>.json`.
  - Page analysis is cached to `runs/pages_<run_timestamp>.json` so pages are never re-scraped unnecessarily.
  - Offline demo viewer loads sample runs and pre-scraped page analysis instantly.

---

## 🚀 Quick Start

### 1. Installation

Ensure Python 3.10+ is installed:

```bash
git clone https://github.com/Digital4local/ai-Link-building-tool.git
cd "Ai Ciataion Prospect"
pip install -r requirements.txt
```

### 2. Configure API Key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

Set it in `.env`:
```bash
GEMINI_API_KEY=AIzaSy...
```
Or enter it directly in the Streamlit sidebar password field.

### 3. Launch the App

```bash
streamlit run app.py
```

---

## 📋 Workflow & Guide

1. **Enter Client & Campaign Details**:
   - **Client Brand Name**: e.g., `Digital Web Solutions`
   - **Client Domain**: e.g., `digitalwebsolutions.com`
   - **Service / Niche**: e.g., `link building agencies`
   - **Market / Location**: e.g., `the UK` or `United States`
   - **Competitors**: One per line, formatted as `Brand Name | domain.com`
   - **Publisher Inventory (Optional)**: CSV file with domain column to highlight pre-existing publisher relationships.

2. **Generate or Craft Prompts**:
   - Click **Generate Prompts** or type custom prompts into the textarea.
   - Adjust number of prompts (5–30) and repeats per prompt (1–3).

3. **Run Campaign**:
   - Click **Run Gemini Citation Prospector**.
   - Monitor the real-time progress bar with rate-limiting pacing.

4. **Analyse Cited Pages (Outreach Intelligence)**:
   - Click **🔍 Analyse Cited Pages** to crawl cited URLs.
   - Inspect competitor gap URLs in the **⚔️ Competitor Gaps** tab.
   - Filter by pitch strategy (*List inclusion*, *Guest post*, *Directory*, *Niche edit*) in **🎯 Link Targets**.
   - Download the enriched CSV target list for direct outreach execution.

---

## 🛡️ Architecture & REST Integration

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Headers**: `x-goog-api-key`, `Content-Type: application/json`
- **Payload**: `{"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]}`
- **Citation Extraction**: Extracts source domains from `candidates[0].groundingMetadata.groundingChunks[].web`, resolving Vertex Search redirects and extracting canonical root domains.
- **On-Page Scraper**: Python `requests` + `BeautifulSoup4` with `lxml` parser, SSL fallback, and 1s domain delay.
