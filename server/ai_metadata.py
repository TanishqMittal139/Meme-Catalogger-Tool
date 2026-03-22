import base64
import binascii
import colorsys
import json
import os
import re
import time
import urllib.error
import urllib.request
from io import BytesIO
from typing import Any


DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")
LOCAL_FALLBACK_ENABLED = os.getenv("LOCAL_METADATA_FALLBACK", "true").strip().lower() != "false"

_PROMPT = """You generate metadata for memes from the actual image content.

Return JSON only with this exact shape:
{
  "title": string,
  "caption": string,
  "keywords": string[]
}

Rules:
- Analyze what is visibly present in the meme image.
- If the meme is humorous, reflect the actual joke or tone in the metadata.
- The title and caption must be different from each other.
- The title should be short and specific.
- The caption should be a fuller description than the title.
- Keywords should be practical search tags based on visible subject, tone, format, and joke.
- Keywords may overlap with other memes, but should still fit this exact meme.
- Do not mention file names or assume context not visible in the image.
- Return 5 to 10 keywords.
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


def _parse_output(output_text: str) -> dict[str, Any]:
    try:
        payload = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise MemeMetadataError("AI response was not valid JSON.") from exc

    title = _normalize_text(payload.get("title"), "Untitled Meme", 80)
    caption = _normalize_text(payload.get("caption"), "Funny meme image", 180)
    keywords = _normalize_keywords(payload.get("keywords"))

    if title.casefold() == caption.casefold():
        caption = f"{caption} meme".strip()[:180]

    if title.casefold() == caption.casefold():
        raise MemeMetadataError("AI produced identical title and caption.")

    if len(keywords) < 3:
        raise MemeMetadataError("AI did not return enough usable keywords.")

    return {
        "title": title,
        "caption": caption,
        "keywords": keywords,
    }


def _load_pillow():
    try:
        from PIL import Image, ImageStat
    except ImportError as exc:
        raise MemeMetadataError("Pillow is not installed. Run pip install -r requirements.txt.") from exc
    return Image, ImageStat


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


def _average_rgb(image: Any) -> tuple[float, float, float]:
    small = image.convert("RGB").resize((64, 64))
    pixels = list(small.getdata())
    count = max(len(pixels), 1)
    red = sum(pixel[0] for pixel in pixels) / count
    green = sum(pixel[1] for pixel in pixels) / count
    blue = sum(pixel[2] for pixel in pixels) / count
    return red, green, blue


def _dominant_color_name(rgb: tuple[float, float, float]) -> str:
    red, green, blue = [value / 255 for value in rgb]
    hue, saturation, lightness = colorsys.rgb_to_hls(red, green, blue)

    if lightness < 0.18:
        return "dark"
    if lightness > 0.82 and saturation < 0.15:
        return "light"
    if saturation < 0.12:
        return "neutral"

    hue_degrees = hue * 360
    if hue_degrees < 20 or hue_degrees >= 340:
        return "red"
    if hue_degrees < 50:
        return "orange"
    if hue_degrees < 70:
        return "yellow"
    if hue_degrees < 170:
        return "green"
    if hue_degrees < 250:
        return "blue"
    if hue_degrees < 300:
        return "purple"
    return "pink"


def _analyze_image_features(image_data_url: str) -> dict[str, Any]:
    Image, ImageStat = _load_pillow()
    _, image_bytes = _decode_data_url(image_data_url)

    with Image.open(BytesIO(image_bytes)) as opened:
        image = opened.convert("RGB")
        width, height = image.size
        grayscale = image.convert("L")
        grayscale_small = grayscale.resize((96, 96))
        rgb_small = image.resize((96, 96))

        grayscale_stat = ImageStat.Stat(grayscale_small)
        brightness = grayscale_stat.mean[0]
        contrast = grayscale_stat.stddev[0]

        average_rgb = _average_rgb(rgb_small)
        red_std, green_std, blue_std = ImageStat.Stat(rgb_small).stddev
        colorfulness = (red_std + green_std + blue_std) / 3

        dark_pixels = 0
        light_pixels = 0
        mid_pixels = 0
        edge_pixels = 0
        pixels = list(grayscale_small.getdata())
        row_width, row_height = grayscale_small.size

        for index, pixel in enumerate(pixels):
            if pixel < 60:
                dark_pixels += 1
            elif pixel > 200:
                light_pixels += 1
            else:
                mid_pixels += 1

            if index % row_width != row_width - 1:
                if abs(pixel - pixels[index + 1]) > 50:
                    edge_pixels += 1
            if index + row_width < len(pixels):
                if abs(pixel - pixels[index + row_width]) > 50:
                    edge_pixels += 1

        total_pixels = max(len(pixels), 1)
        edge_ratio = edge_pixels / (total_pixels * 2)
        dark_ratio = dark_pixels / total_pixels
        light_ratio = light_pixels / total_pixels
        text_heavy = dark_ratio > 0.14 and light_ratio > 0.18 and edge_ratio > 0.16

        aspect_ratio = width / max(height, 1)
        if aspect_ratio >= 1.45:
            layout = "landscape"
        elif aspect_ratio <= 0.8:
            layout = "portrait"
        else:
            layout = "square"

        if brightness < 85:
            mood = "dark"
        elif brightness > 185:
            mood = "bright"
        else:
            mood = "balanced"

        if contrast > 62:
            contrast_label = "high-contrast"
        elif contrast < 32:
            contrast_label = "soft-contrast"
        else:
            contrast_label = "medium-contrast"

        if colorfulness < 18:
            palette = "muted"
        elif colorfulness > 45:
            palette = "colorful"
        else:
            palette = "mixed-color"

        dominant_color = _dominant_color_name(average_rgb)
        likely_reaction = text_heavy and layout in {"portrait", "square"} and contrast > 38
        likely_panel = text_heavy and aspect_ratio >= 1.1

    return {
        "width": width,
        "height": height,
        "layout": layout,
        "mood": mood,
        "contrast": contrast_label,
        "palette": palette,
        "dominant_color": dominant_color,
        "text_heavy": text_heavy,
        "likely_reaction": likely_reaction,
        "likely_panel": likely_panel,
    }


def _build_local_keywords(features: dict[str, Any]) -> list[str]:
    keywords = [
        "meme",
        f"{features['layout']}-format",
        features["contrast"],
        f"{features['mood']}-tone",
        f"{features['dominant_color']}-tones",
    ]

    if features["palette"] == "colorful":
        keywords.append("colorful")
    elif features["palette"] == "muted":
        keywords.append("muted")

    if features["text_heavy"]:
        keywords.extend(["text-heavy", "caption-meme"])
    else:
        keywords.append("image-focused")

    if features["likely_reaction"]:
        keywords.extend(["reaction-meme", "expressive"])

    if features["likely_panel"]:
        keywords.append("panel-layout")

    unique_keywords: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        lowered = keyword.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_keywords.append(keyword)
        if len(unique_keywords) == 10:
            break

    return unique_keywords


def generate_local_meme_metadata(image_data_url: str) -> dict[str, Any]:
    features = _analyze_image_features(image_data_url)

    subject = "reaction meme" if features["likely_reaction"] else "visual meme"
    if features["likely_panel"]:
        subject = "panel meme"

    title_parts = [features["contrast"].replace("-contrast", "").title()]
    if features["text_heavy"]:
        title_parts.append("Captioned")
    title_parts.append(features["layout"].title())
    title_parts.append(subject.title())
    title = " ".join(title_parts)

    caption_bits = [
        f"A {features['layout']} meme with a {features['mood']} overall tone",
        f"{features['contrast'].replace('-', ' ')} visuals",
        f"and mostly {features['dominant_color']} tones",
    ]

    if features["text_heavy"]:
        caption_bits.append("that reads like a text-led joke format")
    elif features["palette"] == "colorful":
        caption_bits.append("that leans on strong color contrast for its look")
    else:
        caption_bits.append("that feels more image-led than text-led")

    caption = ", ".join(caption_bits[:-1]) + " " + caption_bits[-1] + "."

    metadata = {
        "title": _normalize_text(title, "Local Meme Metadata", 80),
        "caption": _normalize_text(caption, "Locally analyzed meme image.", 180),
        "keywords": _build_local_keywords(features),
    }

    if metadata["title"].casefold() == metadata["caption"].casefold():
        metadata["caption"] = f"{metadata['caption']} Meme image.".strip()[:180]

    return metadata


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
                                    "minItems": 3,
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
        except Exception as exc:  # noqa: BLE001 - readable errors should flow into fallback logic
            last_error = exc
            if attempt >= max_attempts:
                break
            time.sleep(1)

    message = str(last_error or "Unknown AI error")
    raise MemeMetadataError(message)


def generate_ollama_meme_metadata(image_data_url: str, max_attempts: int = 2) -> dict[str, Any]:
    _, image_bytes = _decode_data_url(image_data_url)
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    last_error: Exception | None = None

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {
                "role": "user",
                "content": _PROMPT,
                "images": [image_base64],
            }
        ],
    }

    request_body = json.dumps(payload).encode("utf-8")

    for attempt in range(1, max_attempts + 1):
        try:
            request = urllib.request.Request(
                f"{OLLAMA_BASE_URL}/api/chat",
                data=request_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=90) as response:
                response_payload = json.loads(response.read().decode("utf-8"))

            message = response_payload.get("message") or {}
            output_text = message.get("content") or ""
            if not output_text:
                raise MemeMetadataError("Ollama response was empty.")

            return _parse_output(output_text)
        except urllib.error.HTTPError as exc:
            try:
                error_payload = exc.read().decode("utf-8")
            except Exception:  # noqa: BLE001
                error_payload = str(exc)
            last_error = MemeMetadataError(f"Ollama HTTP error: {error_payload}")
        except urllib.error.URLError as exc:
            last_error = MemeMetadataError(
                f"Ollama is not reachable at {OLLAMA_BASE_URL}. Start Ollama and pull a vision model."
            )
        except Exception as exc:  # noqa: BLE001
            last_error = exc

        if attempt < max_attempts:
            time.sleep(1)

    message = str(last_error or "Unknown Ollama error")
    raise MemeMetadataError(message)


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
