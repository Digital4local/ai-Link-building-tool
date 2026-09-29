"""
Gemini Client Module for AI Citation Link Prospector
Centralized client for all Google Gemini API interactions:
- Single entrypoint: gemini_generate()
- Enforces sequential execution & configurable delay (default 6.0s)
- Automatic retry on HTTP 429 & 503 with 20s / 40s / 60s backoff (max 3 retries)
- Native JSON mode (generationConfig.responseMimeType = "application/json")
- Google Search Grounding support (tools: [{"google_search": {}}])
- Session call counter & token usage tracking
"""

import os
import re
import json
import time
import requests

try:
    import streamlit as st
except ImportError:
    st = None


# Module-level tracking
_LAST_CALL_TIMESTAMP = 0.0
_SESSION_CALLS_COUNT = 0


def get_session_calls_count() -> int:
    """Return total number of Gemini calls made in the current session."""
    if st is not None:
        if "gemini_calls" in st.session_state:
            return st.session_state["gemini_calls"]
        if "gemini_calls_count" in st.session_state:
            return st.session_state["gemini_calls_count"]
    return _SESSION_CALLS_COUNT


def increment_session_calls_count() -> int:
    """Increment the session Gemini calls counter."""
    global _SESSION_CALLS_COUNT
    _SESSION_CALLS_COUNT += 1
    if st is not None:
        cnt = st.session_state.get("gemini_calls", st.session_state.get("gemini_calls_count", 0)) + 1
        st.session_state["gemini_calls"] = cnt
        st.session_state["gemini_calls_count"] = cnt
        return cnt
    return _SESSION_CALLS_COUNT


def reset_session_calls_count():
    """Reset the session Gemini calls counter."""
    global _SESSION_CALLS_COUNT
    _SESSION_CALLS_COUNT = 0
    if st is not None:
        st.session_state["gemini_calls"] = 0
        st.session_state["gemini_calls_count"] = 0


def enforce_pacing_delay(delay_sec: float = 6.0, status_callback=None):
    """Enforce sequential delay between API calls to protect free-tier rate limits."""
    global _LAST_CALL_TIMESTAMP
    now = time.time()
    elapsed = now - _LAST_CALL_TIMESTAMP
    if _LAST_CALL_TIMESTAMP > 0 and elapsed < delay_sec:
        wait_time = delay_sec - elapsed
        if status_callback and wait_time > 0.5:
            status_callback(f"Pacing delay: waiting {wait_time:.1f}s to respect free-tier RPM limit...")
        time.sleep(wait_time)


def update_last_call_timestamp():
    """Update timestamp of the most recent Gemini API call."""
    global _LAST_CALL_TIMESTAMP
    _LAST_CALL_TIMESTAMP = time.time()


def normalize_model_name(model: str) -> str:
    """Normalize model string and map to active official Google Gemini endpoints."""
    clean = (model or "gemini-2.5-flash").strip().replace("models/", "")
    clean_lower = clean.lower()
    if "flash" in clean_lower:
        if "2.0" in clean_lower:
            return "gemini-2.0-flash"
        if "1.5" in clean_lower:
            return "gemini-1.5-flash"
        return "gemini-2.5-flash"
    elif "pro" in clean_lower:
        if "2.5" in clean_lower:
            return "gemini-2.5-pro"
        return "gemini-1.5-pro"
    return "gemini-2.5-flash"


def parse_json(text: str):
    """
    Helper parse_json(text): strip ``` fences, take substring between first { or [
    and last } or ], json.loads, return None on failure.
    """
    if not text:
        return None

    # Direct JSON parse
    try:
        return json.loads(text.strip())
    except Exception:
        pass

    # Strip ``` fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Substring between first { and last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(text[first_brace:last_brace + 1])
        except Exception:
            pass

    # Substring between first [ and last ]
    first_sq = text.find("[")
    last_sq = text.rfind("]")
    if first_sq != -1 and last_sq != -1 and last_sq > first_sq:
        try:
            return json.loads(text[first_sq:last_sq + 1])
        except Exception:
            pass

    return None


def extract_json_from_text(text: str):
    """Alias to parse_json for backward compatibility."""
    return parse_json(text)


def gemini_generate(
    prompt: str,
    api_key: str = "",
    model: str = "gemini-3.1-flash-lite",
    use_search: bool = False,
    json_mode: bool = False,
    temperature: float = 0.7,
    system_instruction: str = None,
    delay_sec: float = 6.0,
    max_retries: int = 3,
    status_callback=None
) -> dict:
    """
    Central function for all Gemini API calls in the application.

    Parameters:
    - prompt: The text prompt / user message.
    - api_key: Google AI Studio API key. If empty, reads from os.environ.
    - model: Gemini model identifier (e.g. 'gemini-3.1-flash-lite', 'gemini-3.8-flash').
    - use_search: Whether to enable Google Search grounding tools.
    - json_mode: If True, enforces application/json responseMimeType and parses JSON.
    - temperature: Sampling temperature (0.0 to 1.0).
    - system_instruction: Optional system level instruction.
    - delay_sec: Pacing delay between sequential calls (default: 6.0s).
    - max_retries: Maximum retries on 429/503 errors (default: 3).
    - status_callback: Callable(msg: str) to report live progress.

    Returns:
    dict {
        "text": str,
        "json": object or None,
        "grounding_metadata": dict,
        "raw_response": dict,
        "prompt_tokens": int,
        "candidates_tokens": int,
        "total_tokens": int,
        "model": str,
        "latency_sec": float,
        "status": "ok" | "error",
        "error": str | None
    }
    """
    effective_api_key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    if not effective_api_key:
        return {
            "text": "",
            "grounding_chunks": [],
            "raw": {},
            "error": "No Gemini API Key provided. Please enter your key in the sidebar.",
            "json": None,
            "grounding_metadata": {},
            "raw_response": {},
            "prompt_tokens": 0,
            "candidates_tokens": 0,
            "total_tokens": 0,
            "model": model,
            "latency_sec": 0.0,
            "status": "error"
        }

    active_model = normalize_model_name(model)
    backoff_schedule = [20.0, 40.0, 60.0]

    # Model candidates for automatic fallback
    model_candidates = [active_model]
    for m in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"]:
        if m not in model_candidates:
            model_candidates.append(m)

    headers = {
        "x-goog-api-key": effective_api_key,
        "Content-Type": "application/json"
    }

    # Construct request payload
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": float(temperature)
        }
    }

    # If both json_mode and use_search are requested, never combine them in API payload
    # Drop responseMimeType from payload and parse JSON from the text instead
    if json_mode and not use_search:
        payload["generationConfig"]["responseMimeType"] = "application/json"

    if use_search:
        # Standard Google Search tool format in Gemini v1beta
        payload["tools"] = [{"googleSearch": {}}]

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    last_error = ""

    for candidate_model in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent"

        for attempt in range(max_retries + 1):
            # Enforce sequential pacing delay before firing
            enforce_pacing_delay(delay_sec, status_callback)

            start_t = time.time()
            try:
                increment_session_calls_count()
                r = requests.post(url, headers=headers, json=payload, timeout=35)
                update_last_call_timestamp()
                latency_sec = round(time.time() - start_t, 2)

                # HTTP 200 OK
                if r.status_code == 200:
                    data = r.json()
                    candidates = data.get("candidates") or [{}]
                    cand = candidates[0] if candidates else {}
                    content_parts = cand.get("content", {}).get("parts", [])
                    answer_text = "".join(p.get("text", "") for p in content_parts if isinstance(p, dict))

                    # Parse JSON if json_mode requested
                    parsed_json = None
                    if json_mode:
                        parsed_json = parse_json(answer_text)

                    # Extract token metadata
                    usage = data.get("usageMetadata", {})
                    p_tokens = usage.get("promptTokenCount") or max(1, len(prompt.split()) * 4 // 3)
                    c_tokens = usage.get("candidatesTokenCount") or max(1, len(answer_text.split()) * 4 // 3)
                    tot_tokens = usage.get("totalTokenCount") or (p_tokens + c_tokens)

                    grounding_meta = cand.get("groundingMetadata") or {}
                    grounding_chunks = grounding_meta.get("groundingChunks", [])

                    return {
                        "text": answer_text,
                        "grounding_chunks": grounding_chunks,
                        "raw": data,
                        "error": None,
                        "json": parsed_json,
                        "grounding_metadata": grounding_meta,
                        "raw_response": data,
                        "prompt_tokens": p_tokens,
                        "candidates_tokens": c_tokens,
                        "total_tokens": tot_tokens,
                        "model": candidate_model,
                        "latency_sec": latency_sec,
                        "status": "ok"
                    }

                # HTTP 429 Rate Limit / Quota Exhaustion or HTTP 503 Service Unavailable
                elif r.status_code in (429, 503):
                    err_msg = f"HTTP {r.status_code}: {r.text[:200]}"
                    last_error = err_msg
                    if attempt < max_retries:
                        backoff = backoff_schedule[min(attempt, len(backoff_schedule) - 1)]
                        msg = f"⚠️ Rate limited ({r.status_code}). Backing off for {int(backoff)}s (Retry {attempt + 1}/{max_retries})..."
                        if status_callback:
                            status_callback(msg)
                        if st is not None:
                            try:
                                st.toast(msg, icon="⏳")
                            except Exception:
                                pass
                        time.sleep(backoff)
                        continue
                    else:
                        break

                # HTTP 404 Model Not Found
                elif r.status_code == 404:
                    last_error = f"Model {candidate_model} returned HTTP 404."
                    # Fallback immediately to next model in candidates
                    break

                # HTTP 400 / 401 / 403 or other client errors
                else:
                    last_error = f"HTTP {r.status_code}: {r.text[:250]}"
                    if r.status_code in (401, 403):
                        # Authentication error: no point in retrying
                        return {
                            "text": "",
                            "grounding_chunks": [],
                            "raw": {},
                            "error": last_error,
                            "json": None,
                            "grounding_metadata": {},
                            "raw_response": {},
                            "prompt_tokens": 0,
                            "candidates_tokens": 0,
                            "total_tokens": 0,
                            "model": candidate_model,
                            "latency_sec": latency_sec,
                            "status": "error"
                        }
                    break

            except requests.exceptions.Timeout:
                last_error = f"Request to {candidate_model} timed out after 35s."
                if attempt < max_retries:
                    time.sleep(5.0)
                    continue
                break
            except Exception as ex:
                last_error = f"Request error: {str(ex)}"
                if attempt < max_retries:
                    time.sleep(5.0)
                    continue
                break

    # If all candidates and retries failed
    return {
        "text": "",
        "grounding_chunks": [],
        "raw": {},
        "error": last_error or "Unknown error while communicating with Gemini API.",
        "json": None,
        "grounding_metadata": {},
        "raw_response": {},
        "prompt_tokens": 0,
        "candidates_tokens": 0,
        "total_tokens": 0,
        "model": active_model,
        "latency_sec": 0.0,
        "status": "error"
    }
