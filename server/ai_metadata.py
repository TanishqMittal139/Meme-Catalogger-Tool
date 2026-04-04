import base64
import binascii
import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any


DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2-vision,gemma3,llava:13b")
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
LOCAL_FALLBACK_ENABLED = os.getenv("LOCAL_METADATA_FALLBACK", "false").strip().lower() == "true"

_PROMPT = """You generate high-quality metadata for memes from the actual image content.

Return JSON only with this exact shape:
{
  "title": string,
  "caption": string,
  "keywords": string[]
}

Instructions:
- Carefully inspect both image content and any visible meme text.
- If text appears in the meme, use it to understand the joke before naming the meme.
- Describe the actual joke, reaction, or situation shown, not just generic visual traits.
- If the image is a classic meme format, name the format only if you are confident.
- Do not invent people, brands, events, or context not visible in the image.
- Do not mention file names, uploads, or that this is an AI analysis.

Output rules:
- Title: 3 to 8 words, specific, natural, and search-friendly.
- Caption: 1 sentence, 12 to 28 words, clearly describing the meme's joke or situation.
- Keywords: 6 to 10 short search tags.
- Include tags for subject, emotion/tone, meme format if visible, and joke theme.
- Keep title and caption meaningfully different from each other.
- Avoid vague filler like "funny meme", "humor", or "image".
"""

_ANALYSIS_PROMPT = """Analyze this meme carefully before generating metadata.

Return JSON only with this exact shape:
{
  "visible_text": string[],
  "subjects": string[],
  "meme_format": string,
  "joke_explanation": string,
  "confidence": string
}

Rules:
- Read and transcribe visible meme text as accurately as possible.
- If there is little or no readable text, return an empty array for visible_text.
- Describe the joke or situation in plain language.
- Use meme_format only if you are reasonably confident, otherwise return "unknown".
- confidence must be one of: high, medium, low.
"""

_REFINEMENT_PROMPT = """You are generating metadata for a meme using an image plus a prior analysis.

Return JSON only with this exact shape:
{{
  "title": string,
  "caption": string,
  "keywords": string[]
}}

Use this prior analysis:
{analysis_json}

Rules:
- Base the metadata on the actual joke and visible text, not generic image description.
- If visible_text contains an important quote, let it guide the meaning of the meme.
- Do not call it a different meme format unless the analysis is confident.
- Title: 3 to 8 words, natural and specific.
- Caption: 1 sentence, 12 to 28 words, describing the actual joke or situation.
- Keywords: 6 to 10 short search tags.
- Avoid generic filler like "funny meme", "friday meme", "humor", or "image".
"""


class MemeMetadataError(Exception):
    pass


def _get_client() -> Any:
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise MemeMetadataError("OpenAI package is not installed. Run pip install -r requirements.txt.") from exc

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise MemeMetadataError("OPENAI_API_KEY is not configured.")
    return OpenAI(api_key=api_key)


def _normalize_text(value: Any, fallback: str, max_length: int) -> str:
    if not isinstance(value, str):
        value = fallback
    normalized = " ".join(value.split()).strip()
    if not normalized:
        normalized = fallback
    return normalized[:max_length].strip() or fallback


def _normalize_keywords(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized: list[str] = []
    seen: set[str] = set()

    for item in value:
        if not isinstance(item, str):
            continue
        keyword = " ".join(item.split()).strip().lstrip("#")[:40].strip()
        if not keyword:
            continue

        lowered = keyword.lower()
        if lowered in seen:
            continue

        seen.add(lowered)
        normalized.append(keyword)

        if len(normalized) == 10:
            break

    return normalized


def _extract_json_object(output_text: str) -> str:
    stripped = output_text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fenced_match:
        return fenced_match.group(1)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        return stripped[start : end + 1]

    return stripped


def _parse_output(output_text: str) -> dict[str, Any]:
    payload_text = _extract_json_object(output_text)

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:
        raise MemeMetadataError("AI response was not valid JSON.") from exc

    title = _normalize_text(payload.get("title"), "Untitled Meme", 80)
    caption = _normalize_text(payload.get("caption"), "Funny meme image", 220)
    keywords = _normalize_keywords(payload.get("keywords"))

    if title.casefold() == caption.casefold():
        caption = f"{caption} with a meme-style joke".strip()[:220]

    if title.casefold() == caption.casefold():
        raise MemeMetadataError("AI produced identical title and caption.")

    if len(keywords) < 4:
        raise MemeMetadataError("AI did not return enough usable keywords.")

    return {
        "title": title,
        "caption": caption,
        "keywords": keywords,
    }


def _parse_analysis_output(output_text: str) -> dict[str, Any]:
    payload_text = _extract_json_object(output_text)

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as exc:
        raise MemeMetadataError("AI analysis response was not valid JSON.") from exc

    visible_text = payload.get("visible_text")
    if not isinstance(visible_text, list):
        visible_text = []
    visible_text = [
        _normalize_text(item, "", 160)
        for item in visible_text
        if isinstance(item, str) and _normalize_text(item, "", 160)
    ][:8]

    subjects = payload.get("subjects")
    if not isinstance(subjects, list):
        subjects = []
    subjects = [
        _normalize_text(item, "", 40)
        for item in subjects
        if isinstance(item, str) and _normalize_text(item, "", 40)
    ][:8]

    meme_format = _normalize_text(payload.get("meme_format"), "unknown", 80)
    joke_explanation = _normalize_text(payload.get("joke_explanation"), "Unknown meme joke", 220)
    confidence = _normalize_text(payload.get("confidence"), "low", 20).lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "low"

    return {
        "visible_text": visible_text,
        "subjects": subjects,
        "meme_format": meme_format,
        "joke_explanation": joke_explanation,
        "confidence": confidence,
    }


def _decode_data_url(image_data_url: str) -> tuple[str, bytes]:
    if not isinstance(image_data_url, str) or not image_data_url.startswith("data:image/"):
        raise MemeMetadataError("Meme image is not a supported data URL.")

    match = re.match(r"^data:(image/[^;]+);base64,(.+)$", image_data_url, re.DOTALL)
    if not match:
        raise MemeMetadataError("Meme image data URL is invalid.")

    mime_type = match.group(1)
    encoded_data = match.group(2)

    try:
        image_bytes = base64.b64decode(encoded_data)
    except (ValueError, binascii.Error) as exc:
        raise MemeMetadataError("Meme image data could not be decoded.") from exc

    return mime_type, image_bytes


def generate_openai_meme_metadata(image_data_url: str, max_attempts: int = 2) -> dict[str, Any]:
    client = _get_client()
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.responses.create(
                model=DEFAULT_MODEL,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": _PROMPT},
                            {
                                "type": "input_image",
                                "image_url": image_data_url,
                                "detail": "high",
                            },
                        ],
                    }
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "meme_metadata",
                        "schema": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "title": {"type": "string"},
                                "caption": {"type": "string"},
                                "keywords": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 4,
                                    "maxItems": 10,
                                },
                            },
                            "required": ["title", "caption", "keywords"],
                        },
                    }
                },
            )

            output_text = getattr(response, "output_text", "") or ""
            if not output_text:
                raise MemeMetadataError("AI response was empty.")

            return _parse_output(output_text)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= max_attempts:
                break
            time.sleep(1)

    message = str(last_error or "Unknown AI error")
    raise MemeMetadataError(message)


def _ollama_model_candidates() -> list[str]:
    candidates: list[str] = []
    for item in OLLAMA_MODEL.split(","):
        cleaned = item.strip()
        if cleaned and cleaned not in candidates:
            candidates.append(cleaned)
    return candidates or ["gemma3"]


def _ollama_chat(model_name: str, prompt: str, image_base64: str | None) -> str:
    message: dict[str, Any] = {
        "role": "user",
        "content": prompt,
    }
    if image_base64:
        message["images"] = [image_base64]

    payload = {
        "model": model_name,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": OLLAMA_TEMPERATURE,
        },
        "messages": [message],
    }

    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=OLLAMA_TIMEOUT_SECONDS) as response:
        response_payload = json.loads(response.read().decode("utf-8"))

    output_message = response_payload.get("message") or {}
    output_text = output_message.get("content") or ""
    if not output_text:
        raise MemeMetadataError(f"Ollama response was empty for model {model_name}.")
    return output_text


def generate_ollama_meme_metadata(image_data_url: str, max_attempts: int = 2) -> dict[str, Any]:
    _, image_bytes = _decode_data_url(image_data_url)
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    last_error: Exception | None = None

    for model_name in _ollama_model_candidates():
        for attempt in range(1, max_attempts + 1):
            try:
                analysis_text = _ollama_chat(model_name, _ANALYSIS_PROMPT, image_base64)
                analysis = _parse_analysis_output(analysis_text)
                metadata_prompt = _REFINEMENT_PROMPT.format(
                    analysis_json=json.dumps(analysis, ensure_ascii=True)
                )
                output_text = _ollama_chat(model_name, metadata_prompt, image_base64)
                return _parse_output(output_text)
            except urllib.error.HTTPError as exc:
                try:
                    error_payload = exc.read().decode("utf-8")
                except Exception:  # noqa: BLE001
                    error_payload = str(exc)
                last_error = MemeMetadataError(f"Ollama HTTP error for {model_name}: {error_payload}")
            except urllib.error.URLError:
                last_error = MemeMetadataError(
                    f"Ollama is not reachable at {OLLAMA_BASE_URL}. Start Ollama and pull a vision model."
                )
            except Exception as exc:  # noqa: BLE001
                last_error = exc

            if attempt < max_attempts:
                time.sleep(1)

    message = str(last_error or "Unknown Ollama error")
    raise MemeMetadataError(message)


def generate_local_meme_metadata(_: str) -> dict[str, Any]:
    raise MemeMetadataError(
        "Local fallback metadata is disabled. Enable LOCAL_METADATA_FALLBACK=true only if you want low-confidence backup metadata."
    )


def generate_meme_metadata(image_data_url: str) -> dict[str, Any]:
    if not isinstance(image_data_url, str) or not image_data_url.startswith("data:image/"):
        raise MemeMetadataError("Meme image is not a supported data URL.")

    provider_errors: list[str] = []

    try:
        return generate_openai_meme_metadata(image_data_url)
    except MemeMetadataError as error:
        provider_errors.append(str(error))

    try:
        return generate_ollama_meme_metadata(image_data_url)
    except MemeMetadataError as error:
        provider_errors.append(str(error))

    if not LOCAL_FALLBACK_ENABLED:
        raise MemeMetadataError(" | ".join(provider_errors))

    try:
        return generate_local_meme_metadata(image_data_url)
    except MemeMetadataError as error:
        error_messages = provider_errors + [str(error)]
        raise MemeMetadataError(" | ".join(error_messages)) from error
