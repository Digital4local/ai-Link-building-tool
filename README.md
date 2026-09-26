# 🎯 AI Citation Link Prospector

**AI Citation Link Prospector** is a specialised SEO & Digital PR intelligence tool designed to reverse-engineer Google Gemini's AI citations (via Google Search Grounding) for any niche and geographic market.

It identifies the exact websites Gemini cites when answering high-intent buyer and research queries, categorises them, and calculates actionable **Priority Link-Building & Outreach Scores**.

---

## 🌟 Key Features

- **Gemini-First Search Grounding**: Direct REST API integration with `gemini-2.5-flash` using Google Search tools (`google_search`).
- **Free-Tier Rate Limiting Safety**:
  - Sequential requests with configurable pacing delay (default: 6.0 seconds).
  - Automatic exponential retry on HTTP 429 (`ResourceExhausted`), waiting 20 seconds up to 3 times before failing safely.
  - Transparent error logging without application crashes.
- **Smart Prompt Generator**: Generates varied, realistic buyer-intent queries (comparisons, best-of, selection criteria, pricing, trust) with fallback templates.
- **Prompt Repeat Consistency**: Runs queries across multiple iterations to determine consistency (%) and ranking stability of cited domains.
- **Competitor Gap & Share of Voice Analysis**:
  - Detects when competitors win mentions in Gemini answers where the client is omitted (`cited_where_competitor_wins`).
  - Measures brand Share of Voice (SoV %) across all answers.
- **Intelligent Domain Classification**:
  - **Client's Own Site**
  - **Competitor Sites**
  - **Community / UGC** (Reddit, Quora, YouTube, LinkedIn, Medium, Wikipedia...) → *Brand mention play*
  - **Directory / Review** (Clutch, G2, Trustpilot, Yelp, GoodFirms, DesignRush...) → *Get listed*
  - **Publisher Inventory** (matched against your uploaded CSV) → *Pitch now*
  - **Outreach Targets** → *Link outreach target*
- **Gemini Token Usage & Rate Limit Counter (Extension Feature)**:
  - Tracks exact **Input (Prompt) Tokens**, **Output (Candidate) Tokens**, and **Total Tokens** from Gemini API `usageMetadata`.
  - Real-time **Requests Per Minute (RPM)** and **Daily Request Quota (RPD)** visual progress gauges.
  - Live **Estimated API Cost calculator** (Flash rates vs Free Tier: $0.00).
  - Dedicated **⚡ Token & Quota Monitor Tab** with per-query token breakdowns, visual distribution charts, and CSV report export.
  - Sidebar live widget with real-time rate meters and instant counter reset button.
- **Priority Scoring Formula**:
  $$\text{Priority Score} = \text{Citations} + (2 \times \text{Prompts Cited In}) + (2 \times \text{Competitor Wins}) + \frac{\text{Consistency \%}}{25}$$
- **Run Persistence & Demo Viewer**:
  - Every run is automatically saved to `runs/<timestamp>.json`.
  - Sidebar file uploader and selector allows reloading any past run instantly for offline presentations and reporting.
- **Export Ready**: Instant CSV target list download with domain priority metrics and top cited URLs.

---

## 🚀 Quick Start

### 1. Installation

Ensure Python 3.10+ is installed:

```bash
git clone <repo-url>
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
   - Click **Run Gemini Citation Analysis**.
   - Monitor the real-time progress bar with rate-limiting pacing.

4. **Explore & Export Targets**:
   - Review top domains in the **Link Targets** tab.
   - Filter by Action type (e.g., outreach targets, review sites, UGC).
   - Inspect competitor gap analysis in **Share of Voice**.
   - Download the target list as CSV for your outreach CRM.

---

## 🛡️ Architecture & REST Integration

- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Headers**: `x-goog-api-key`, `Content-Type: application/json`
- **Payload**: `{"contents": [{"parts": [{"text": prompt}]}], "tools": [{"google_search": {}}]}`
- **Citation Extraction**: Extracts source domains from `candidates[0].groundingMetadata.groundingChunks[].web`, resolving Vertex Search redirects and extracting canonical root domains.
