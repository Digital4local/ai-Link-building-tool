# 🎯 AI Citation Link Prospector

**AI Citation Link Prospector** is a specialized SEO & Digital PR intelligence tool designed to reverse-engineer Google Gemini's AI citations (via Google Search Grounding) for any niche and geographic market.

It identifies the exact websites Gemini cites when answering high-intent buyer and research queries, categorises them, scrapes and analyses each cited page, calculates rule-based **Citation-Worthiness Scores**, builds AI-optimized **Content Briefs**, generates personalized **Outreach Pitches**, and exports executive white-label **Client Reports (Excel & HTML)**.

---

## 🌟 Complete Feature Breakdown

### 1. 📊 Citation-Worthiness Score (0–100 Rule-Based, No API Calls)
Evaluates why Google Gemini cites specific pages by analyzing technical on-page authority signals:
- **Freshness**: Published/updated within last 6 months (+20 pts) or last 12 months (+10 pts).
- **Statistics & Data Points**: Density of percentages, currency figures (£, $, €), and research keywords (`study`, `survey`, `dataset`, `benchmark`) (+up to 15 pts).
- **List Structure**: $\ge 3$ `<li>` list items in main content or numbered H2/H3 headings (+15 pts).
- **FAQ Section**: Explicit FAQ headings or Schema `FAQPage`/`Question` JSON-LD (+15 pts).
- **Structured Schema**: Valid JSON-LD structured data present (+10 pts).
- **Content Depth**: Word count $\ge 1,000$ words (+15 pts) or $\ge 600$ words (+8 pts).
- **Author Attribution**: Author meta tags, byline classes, or written-by text patterns (+10 pts).
- **UI Metrics**: Displays scores across all target tables and calculates the **Average Citation Score** for the top 20 cited pages.

### 2. 📑 AI Content Brief Generator (`content_brief.py`)
- Single-click **"Build content brief"** action analyzing the titles, H2 heading outlines, and citation scores of the top 10 winning pages.
- Uses Gemini in native JSON mode (`gemini-3.1-flash-lite`) to produce:
  - **Common Winning Angles**: Editorial hooks and narrative structures favored by AI engines.
  - **High-Intent Questions Answered**: Core user queries addressed across top ranking pages.
  - **Data Points & Benchmarks**: Statistical figures and pricing ranges to include.
  - **Recommended Content Format**: Optimal word count, heading hierarchy, and visual asset suggestions.
  - **5 Linkable Asset / Guest Post Ideas**: High-authority concepts engineered to get cited by LLMs.
- Displayed in the dedicated **"📑 Content Brief"** tab and cached to `runs/brief_<timestamp>.json`.

### 3. 📄 White-Label Client Report Exports (`client_report.py`)
- **Multi-Sheet Excel Workbook (`report.xlsx`)** via `openpyxl`:
  - **`Summary`**: Executive campaign metadata, client/competitor overview, and token usage.
  - **`Link targets`**: Prioritised domain targets with scores, citation frequency, and contact info.
  - **`Competitor gaps`**: Exact URLs citing competitors where the client brand is missing.
  - **`Brand position`**: Share of voice %, average position rank, and sentiment breakdown.
  - **`Pitches`**: Tailored outreach email drafts, subject lines, and anchor suggestions.
  - **`Content brief`**: Angles, questions, data benchmarks, format outline, and 5 linkable asset ideas.
- **Executive Single-Page HTML Report (`report.html`)**:
  - Clean, responsive dashboard with custom **Agency Name** entered in sidebar.
  - Key KPI summary cards (Share of Voice, Avg Position, Targets, Gaps).
  - Top 10 Link Targets & Top 5 Competitor Gaps tables.
  - 5 Linkable Asset cards with AI citation rationale and outreach pitch angles.
  - Full `@media print` support for instant PDF export in browser.

### 4. 📈 Campaigns & Trend Intelligence (`campaign_analytics.py`)
- **Campaign Slug History**: Groups runs by `client-service-market` slug with 1-click loading.
- **Brand Share of Voice Over Time**: Multi-run line chart tracking client and competitor visibility trends.
- **Domain Churn Tracking**: Automatic breakdown of 🆕 **New Domains Cited**, 🔻 **Lost Domains**, and 🔄 **Stable Domains**.
- **"Won Links Now Cited" Attribution**: Upload a CSV of built links (`url` column) to measure if acquired links are now cited by Google Gemini.

### 5. 🌍 Multi-Market Mode
- Enter multiple target markets (e.g., `the UK, the US, Australia, Germany`).
- Executes localized buyer queries across each region.
- Interactive **Domain × Market Citation Heatmap** showing cross-border vs geo-specific authority targets.

### 6. 👑 Brand Position & Sentiment Analysis (`brand_analysis.py`)
- Extracts exact recommendation hierarchy (Position #1, #2, #3, or null) in AI responses.
- Computes average rank position, % of answers in top 3, and sentiment breakdown (Positive / Neutral / Negative).

### 7. ✉️ Personalized Outreach Pitch Generator (`pitch_generator.py`)
- Checkbox selection in **Link Targets** or **Competitor Gaps** tables.
- Crafts tailored pitches (under 120 words, zero fluff, single clear ask) matching pitch strategy (*List inclusion*, *Directory*, *Guest post*, *Niche edit*).
- Interactive copy expanders and batch CSV export.

### 8. ⚡ Rate-Limited Free-Tier Gemini Client (`gemini_client.py`)
- Sequential pacing delay (default 6.0s).
- Automatic backoff retries on HTTP 429/503 (20s / 40s / 60s delays, max 3 retries).
- Native JSON response mode and session call counter.

---

## 🚀 Quick Start & Setup

### 1. Requirements & Installation

```bash
git clone https://github.com/Digital4local/ai-Link-building-tool.git
cd "Ai Ciataion Prospect"
pip install -r requirements.txt
```

#### Required Dependencies (`requirements.txt`):
- `streamlit>=1.35.0`
- `pandas>=2.0.0`
- `requests>=2.31.0`
- `python-dotenv>=1.0.0`
- `beautifulsoup4>=4.12.0`
- `lxml>=5.0.0`
- `openpyxl>=3.1.2`

### 2. Configure API Key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

Set it in `.env`:
```env
GEMINI_API_KEY=AIzaSy...
```
*Or enter it directly in the Streamlit sidebar password field during execution.*

### 3. Run Application

```bash
streamlit run app.py
```

---

## ⏱️ Gemini Free-Tier Rate Limits & Best Practices

| Model | Free Tier RPM | Free Tier RPD | Recommended Pacing |
| :--- | :---: | :---: | :---: |
| **`gemini-3.1-flash-lite`** (Recommended) | 15 RPM | 1,500 RPD | 4.0s - 6.0s delay |
| **`gemini-2.5-flash`** | 15 RPM | 1,500 RPD | 5.0s - 6.0s delay |
| **`gemini-2.5-pro`** | 2 RPM | 50 RPD | 30.0s delay |

> [!TIP]
> The app includes built-in rate-limiting safety. If you hit a 429 quota threshold, the client automatically pauses and retries with 20s / 40s / 60s backoff delays.

---

## 📂 Project Structure

```
├── app.py                   # Main Streamlit application & interactive UI
├── page_analysis.py         # On-page scraping & Citation-Worthiness scoring (0-100)
├── content_brief.py         # AI Content Brief generator (winning angles & 5 linkable asset ideas)
├── client_report.py         # Multi-sheet Excel (openpyxl) & HTML white-label report exports
├── brand_analysis.py        # Brand position ranking & sentiment analysis
├── pitch_generator.py       # Tailored outreach email generator with CSV export
├── campaign_analytics.py    # Trend comparison, won-link attribution, & multi-market heatmaps
├── gemini_client.py         # Rate-limited REST Gemini client with retry backoff
├── requirements.txt         # Project dependencies
├── .env.example             # Example environment file
└── runs/                    # Persistent JSON caches for runs, pages, brands, & briefs
```

---

## 📄 License
MIT License. Built for SEO professionals, digital PR agencies, and link-building teams.
