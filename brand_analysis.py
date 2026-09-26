"""
Brand Position & Sentiment Analysis Module
Evaluates brand visibility hierarchy, ordinal position (ranking in list-style answers),
and sentiment (positive / neutral / negative) for client and competitor brands across
all AI answers using Gemini in JSON mode.
"""

import os
import re
import json
import pandas as pd
from gemini_client import gemini_generate


def get_brand_cache_path(run_payload: dict, file_path: str = "") -> str:
    """Generate standardized brand position cache file path in runs/."""
    os.makedirs("runs", exist_ok=True)
    if file_path:
        base = os.path.basename(file_path)
        if base.startswith("pages_"):
            base = base[6:]
        if base.startswith("brands_"):
            base = base[7:]
        if base.endswith(".json"):
            return os.path.join("runs", f"brands_{base}")
            
    created = run_payload.get("created", "") if isinstance(run_payload, dict) else ""
    if created:
        safe_ts = str(created).replace(":", "-")
        return os.path.join("runs", f"brands_{safe_ts}.json")
    return os.path.join("runs", "brands_cached.json")


def load_cached_brands(cache_path: str) -> list[dict]:
    """Load cached brand position analysis from disk if available."""
    if not cache_path or not os.path.exists(cache_path):
        return []
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []


def save_cached_brands(brand_results: list[dict], cache_path: str) -> bool:
    """Save brand analysis results to cache JSON file."""
    if not cache_path or not brand_results:
        return False
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(brand_results, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


def fallback_rule_based_brand_analysis(answer_text: str, client_name: str, comp_names: list[str]) -> list[dict]:
    """
    Rule-based fallback for brand position & sentiment analysis if API is offline or quota-limited.
    Determines order of appearance in text and simple context sentiment.
    """
    all_brands = []
    if client_name:
        all_brands.append(client_name)
    for c in comp_names:
        if c and c not in all_brands:
            all_brands.append(c)

    # Find earliest match offset for each brand
    found_offsets = []
    lower_text = answer_text.lower() if answer_text else ""

    for b in all_brands:
        pattern = r"(?<!\w)" + re.escape(b.lower()) + r"(?!\w)"
        m = re.search(pattern, lower_text)
        if m:
            found_offsets.append((b, m.start()))

    # Sort by order of appearance
    found_offsets.sort(key=lambda x: x[1])
    brand_positions = {brand: idx + 1 for idx, (brand, _) in enumerate(found_offsets)}

    results = []
    for b in all_brands:
        if b in brand_positions:
            pos = brand_positions[b]
            # Simple sentiment heuristic
            sentiment = "positive"
            reason = f"Mentioned at position #{pos} in AI answer"
            if "avoid" in lower_text or "caution" in lower_text or "expensive" in lower_text:
                if re.search(r"(?:avoid|caution|drawback|cons).*?" + re.escape(b.lower()), lower_text):
                    sentiment = "negative"
                    reason = "Mentioned with noted drawbacks"
            results.append({
                "name": b,
                "position": pos,
                "sentiment": sentiment,
                "reason": reason
            })
        else:
            results.append({
                "name": b,
                "position": None,
                "sentiment": "neutral",
                "reason": "Not mentioned in response"
            })

    return results


def analyze_single_answer_brands(
    answer_text: str,
    client_name: str,
    comp_names: list[str],
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    delay_sec: float = 6.0
) -> list[dict]:
    """
    Ask Gemini (in JSON mode) to evaluate brand order of mention (position) and sentiment.
    """
    if not answer_text or not answer_text.strip():
        return []

    all_brand_names = []
    if client_name:
        all_brand_names.append(client_name)
    for c in comp_names:
        if c and c not in all_brand_names:
            all_brand_names.append(c)

    if not all_brand_names:
        return []

    # If no API key, use deterministic fallback
    if not api_key:
        return fallback_rule_based_brand_analysis(answer_text, client_name, comp_names)

    brand_list_str = ", ".join([f'"{b}"' for b in all_brand_names])
    
    prompt = (
        "You are an expert AI response analyst. Analyze the following AI-generated answer to a search query.\n\n"
        f"Target Brands to evaluate: [{brand_list_str}]\n\n"
        "AI Answer Text:\n"
        f'"""\n{answer_text}\n"""\n\n'
        "TASK INSTRUCTIONS:\n"
        "For EACH of the target brands listed above, evaluate:\n"
        "1. 'position': The 1-based ordinal position/rank in which the brand is first mentioned in any recommendation, numbered list, or comparative breakdown (e.g. 1 for 1st mentioned/ranked brand, 2 for 2nd, etc.). If the brand is NOT mentioned in the text at all, return null.\n"
        "2. 'sentiment': Exactly one of 'positive', 'neutral', or 'negative' based on how the brand is portrayed.\n"
        "3. 'reason': A short concise explanation (under 12 words) of why this position and sentiment was assigned.\n\n"
        "Return ONLY a JSON object matching this exact schema:\n"
        "{\n"
        '  "brands": [\n'
        '    {\n'
        '      "name": "Brand Name",\n'
        '      "position": 1,\n'
        '      "sentiment": "positive",\n'
        '      "reason": "Top recommended agency for link outreach"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    res = gemini_generate(
        prompt=prompt,
        api_key=api_key,
        model=model,
        use_search=False,
        json_mode=True,
        temperature=0.2,
        delay_sec=delay_sec
    )

    if res.get("status") == "ok" and res.get("json"):
        json_obj = res["json"]
        if isinstance(json_obj, dict) and "brands" in json_obj and isinstance(json_obj["brands"], list):
            parsed_brands = json_obj["brands"]
            # Ensure all requested brands exist in result
            returned_names = {str(b.get("name", "")).strip().lower(): b for b in parsed_brands if isinstance(b, dict)}
            final_brands = []
            for b in all_brand_names:
                b_key = b.strip().lower()
                if b_key in returned_names:
                    final_brands.append(returned_names[b_key])
                else:
                    # Check fuzzy match
                    matched = None
                    for rk, robj in returned_names.items():
                        if b_key in rk or rk in b_key:
                            matched = robj
                            break
                    if matched:
                        final_brands.append(matched)
                    else:
                        final_brands.append({
                            "name": b,
                            "position": None,
                            "sentiment": "neutral",
                            "reason": "Not mentioned"
                        })
            return final_brands

    # Fallback if JSON generation was unavailable or malformed
    return fallback_rule_based_brand_analysis(answer_text, client_name, comp_names)


def analyze_all_records_brands(
    records: list[dict],
    client_dict: dict,
    competitors: list[dict],
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    delay_sec: float = 6.0,
    progress_callback=None
) -> list[dict]:
    """
    Run brand position & sentiment analysis across all successful answers in records.
    """
    client_name = client_dict.get("name", "").strip() if isinstance(client_dict, dict) else ""
    comp_names = [c["name"].strip() for c in competitors if isinstance(c, dict) and c.get("name")]
    
    valid_records = [r for r in records if not r.get("error") and r.get("answer")]
    total = len(valid_records)
    results = []

    for idx, r in enumerate(valid_records):
        p_idx = r.get("prompt_index", idx)
        rep = r.get("repeat", 1)
        prompt_text = r.get("prompt", "")
        answer_text = r.get("answer", "")

        if progress_callback:
            progress_callback(
                (idx) / max(total, 1),
                f"Analyzing brand positions for Prompt {p_idx + 1} (Run {rep}) [{idx + 1}/{total}]..."
            )

        try:
            brands_data = analyze_single_answer_brands(
                answer_text=answer_text,
                client_name=client_name,
                comp_names=comp_names,
                api_key=api_key,
                model=model,
                delay_sec=delay_sec
            )
        except Exception:
            brands_data = fallback_rule_based_brand_analysis(answer_text, client_name, comp_names)

        results.append({
            "prompt_index": p_idx,
            "repeat": rep,
            "prompt": prompt_text,
            "brands": brands_data
        })

    if progress_callback:
        progress_callback(1.0, f"Completed brand position & sentiment analysis for all {total} answers!")

    return results


def calculate_brand_position_summary(
    brand_results: list[dict],
    client_dict: dict,
    competitors: list[dict]
) -> pd.DataFrame:
    """
    Aggregate per-answer brand results into a summary DataFrame:
    - brand
    - role (Client vs Competitor)
    - mentions (count)
    - mention_rate_pct (% of total answers)
    - avg_position (average position when mentioned; lower is better)
    - pct_top_3 (% of total answers where brand was in positions 1, 2, or 3)
    - pct_positive, pct_neutral, pct_negative
    - dominant_sentiment
    """
    if not brand_results:
        return pd.DataFrame()

    client_name = client_dict.get("name", "").strip() if isinstance(client_dict, dict) else ""
    comp_names = [c["name"].strip() for c in competitors if isinstance(c, dict) and c.get("name")]

    all_brands = []
    if client_name:
        all_brands.append({"name": client_name, "role": "Client (Your Brand)"})
    for c in comp_names:
        if c and not any(b["name"].lower() == c.lower() for b in all_brands):
            all_brands.append({"name": c, "role": "Competitor"})

    total_answers = len(brand_results)
    if total_answers == 0:
        return pd.DataFrame()

    summary_rows = []

    for b_info in all_brands:
        b_name = b_info["name"]
        b_role = b_info["role"]
        b_lower = b_name.lower()

        positions = []
        sentiments = []
        reasons = []

        for item in brand_results:
            brands_in_ans = item.get("brands", [])
            for entry in brands_in_ans:
                name_entry = str(entry.get("name", "")).strip().lower()
                if name_entry == b_lower or b_lower in name_entry:
                    pos = entry.get("position")
                    if pos is not None and isinstance(pos, (int, float)) and pos > 0:
                        positions.append(float(pos))
                    
                    sent = str(entry.get("sentiment", "neutral")).lower()
                    if sent in ("positive", "neutral", "negative"):
                        sentiments.append(sent)
                    else:
                        sentiments.append("neutral")
                    
                    r = entry.get("reason", "")
                    if r:
                        reasons.append(r)
                    break

        mentions_count = len(positions)
        mention_rate = round((mentions_count / total_answers) * 100, 1)
        
        avg_pos = round(sum(positions) / mentions_count, 1) if mentions_count > 0 else None
        
        # Count top 3 mentions
        top_3_count = sum(1 for p in positions if p <= 3)
        pct_top_3 = round((top_3_count / total_answers) * 100, 1)

        # Sentiment breakdown
        pos_count = sum(1 for s in sentiments if s == "positive")
        neu_count = sum(1 for s in sentiments if s == "neutral")
        neg_count = sum(1 for s in sentiments if s == "negative")
        total_sents = max(len(sentiments), 1)

        pct_pos = round((pos_count / total_sents) * 100, 1) if mentions_count > 0 else 0.0
        pct_neu = round((neu_count / total_sents) * 100, 1) if mentions_count > 0 else 0.0
        pct_neg = round((neg_count / total_sents) * 100, 1) if mentions_count > 0 else 0.0

        if mentions_count == 0:
            dominant_sentiment = "Not Mentioned"
        elif pos_count >= neu_count and pos_count >= neg_count:
            dominant_sentiment = "Positive 🟢"
        elif neg_count > pos_count and neg_count >= neu_count:
            dominant_sentiment = "Negative 🔴"
        else:
            dominant_sentiment = "Neutral ⚪"

        summary_rows.append({
            "brand": b_name,
            "role": b_role,
            "mentions": mentions_count,
            "mention_rate_pct": mention_rate,
            "avg_position": avg_pos if avg_pos is not None else 99.0,
            "avg_position_display": f"#{avg_pos:.1f}" if avg_pos is not None else "-",
            "pct_top_3": pct_top_3,
            "pct_positive": pct_pos,
            "pct_neutral": pct_neu,
            "pct_negative": pct_neg,
            "dominant_sentiment": dominant_sentiment
        })

    df = pd.DataFrame(summary_rows)
    if not df.empty:
        # Sort by avg_position ascending (1.0 is best rank), then mentions descending
        df = df.sort_values(by=["avg_position", "mentions"], ascending=[True, False]).reset_index(drop=True)
    return df
