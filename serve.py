#!/usr/bin/env python3
"""Daymark local companion: serves the app and safely bridges it to Ollama.

Uses only the Python standard library. Listens on 127.0.0.1 only.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("DAYMARK_PORT", "8765"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
MAX_REQUEST_BYTES = 42 * 1024 * 1024
MAX_TOTAL_IMAGE_BYTES = 32 * 1024 * 1024
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGES = 20

SCHEMA = {
    "type": "object",
    "properties": {
        "subjectName": {"type": "string"},
        "structureLabel": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "number": {"type": "string"},
                    "title": {"type": "string"},
                    "startPage": {"type": ["integer", "null"]},
                    "endPage": {"type": ["integer", "null"]},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "notes": {"type": "string"},
                    "activities": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["video", "experiment", "test", "reading", "exercise", "quiz", "project", "other"]},
                                "title": {"type": "string"},
                                "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                            },
                            "required": ["type", "title", "confidence"],
                        },
                    },
                },
                "required": ["number", "title", "startPage", "endPage", "confidence", "notes", "activities"],
            },
        },
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subjectName", "structureLabel", "sections", "warnings"],
}


def http_json(url: str, payload: dict | None = None, timeout: int = 20) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read(2048).decode("utf-8", "replace")
        raise RuntimeError(f"Ollama returned HTTP {exc.code}: {detail[:700]}") from exc
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        raise RuntimeError(f"Could not reach Ollama at {OLLAMA_URL}. Make sure Ollama is installed and running. ({reason})") from exc
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Ollama returned an invalid JSON response.") from exc
    if not isinstance(value, dict):
        raise RuntimeError("Ollama returned an unexpected response.")
    return value


def get_ollama_version() -> str:
    data = http_json(f"{OLLAMA_URL}/api/version", timeout=5)
    return str(data.get("version", "unknown"))


def get_models() -> list[dict]:
    tags = http_json(f"{OLLAMA_URL}/api/tags", timeout=10)
    raw_models = tags.get("models", [])
    models: list[dict] = []
    for item in raw_models:
        name = str(item.get("name") or item.get("model") or "").strip()
        if not name:
            continue
        details = item.get("details") or {}
        capabilities: list[str] = []
        show_error = ""
        try:
            info = http_json(f"{OLLAMA_URL}/api/show", {"model": name}, timeout=12)
            capabilities = [str(x).lower() for x in info.get("capabilities", []) if x]
            model_info = info.get("model_info") or {}
            architecture = " ".join(str(v) for k, v in model_info.items() if "architecture" in str(k).lower()).lower()
            family = str((info.get("details") or {}).get("family") or details.get("family") or "").lower()
            is_vision = "vision" in capabilities or any(token in architecture for token in ("vl", "vision", "llava", "minicpmv", "mllama"))
            if not is_vision:
                is_vision = any(token in name.lower() for token in (
                    "-vl", ".vl", "vision", "llava", "bakllava", "moondream", "minicpm-v", "minicpmv", "qwen2.5vl", "qwen2-vl", "qwen3-vl", "gemma3", "mistral-small3.1", "mistral-small3.2"
                ))
            capabilities = capabilities or (["vision"] if is_vision else [])
        except Exception as exc:
            show_error = str(exc)[:180]
            # Conservative fallback for Ollama builds that don't expose /api/show capabilities.
            name_lower = name.lower()
            is_vision = any(token in name_lower for token in (
                "-vl", ".vl", "vision", "llava", "bakllava", "moondream", "minicpm-v", "minicpmv", "qwen2.5vl", "qwen2-vl", "qwen3-vl", "gemma3", "mistral-small3.1", "mistral-small3.2"
            ))
            if is_vision:
                capabilities = ["vision (name-based detection)"]
        is_cloud = "-cloud" in name.lower() or name.lower().endswith(":cloud")
        if is_cloud:
            is_vision = False
        models.append({
            "name": name,
            "parameterSize": str(details.get("parameter_size") or ""),
            "family": str(details.get("family") or ""),
            "size": int(item.get("size") or 0),
            "cloud": is_cloud,
            "vision": bool(is_vision),
            "capabilities": capabilities,
            "detectionNote": show_error,
        })
    return models


def decode_image(value: Any, index: int) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"Image {index} is missing or invalid.")
    if value.startswith("data:"):
        header, sep, encoded = value.partition(",")
        if not sep or ";base64" not in header:
            raise ValueError(f"Image {index} must be a base64 data URL.")
    else:
        encoded = value
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError(f"Image {index} is not valid base64 data.") from exc
    if not raw:
        raise ValueError(f"Image {index} is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError(f"Image {index} exceeds the 12 MB limit after encoding. Reduce its size and retry.")
    return base64.b64encode(raw).decode("ascii")


def parse_model_json(content: str) -> dict:
    text = str(content or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        first, last = text.find("{"), text.rfind("}")
        if first < 0 or last <= first:
            raise RuntimeError("The vision model did not return structured curriculum data. Try a clearer image or another vision model.")
        try:
            parsed = json.loads(text[first:last + 1])
        except json.JSONDecodeError as exc:
            raise RuntimeError("The vision model's curriculum response was not valid JSON. Try fewer pages or another vision model.") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("The vision model returned data in an unexpected format.")
    return parsed


def analyze_curriculum(payload: dict) -> dict:
    images_in = payload.get("images")
    if not isinstance(images_in, list) or not images_in:
        raise ValueError("Choose one or more images or PDFs first.")
    if len(images_in) > MAX_IMAGES:
        raise ValueError(f"Choose {MAX_IMAGES} pages or fewer per import.")
    images = [decode_image(item, index + 1) for index, item in enumerate(images_in)]
    total_bytes = sum(len(base64.b64decode(item)) for item in images)
    if total_bytes > MAX_TOTAL_IMAGE_BYTES:
        raise ValueError("The selected pages exceed the 32 MB total limit. Split the import into smaller batches.")

    model = str(payload.get("model") or "").strip()
    if not model or len(model) > 180:
        raise ValueError("Select an installed vision-capable Ollama model first.")
    available = get_models()
    chosen = next((item for item in available if item["name"] == model), None)
    if not chosen:
        raise ValueError(f"The model '{model}' is not installed in Ollama. Refresh the model list and select an installed model.")
    if chosen.get("cloud"):
        raise ValueError(f"'{model}' appears to be an Ollama cloud model. Daymark's local importer only accepts models that run on this computer.")
    if not chosen.get("vision"):
        raise ValueError(f"'{model}' does not advertise image/vision capability in Ollama. Your Qwen 27B installation may be text-only; choose a model whose Ollama capabilities include vision.")

    structure_label = str(payload.get("structureLabel") or "Chapter").strip()[:60] or "Chapter"
    reference_text = str(payload.get("ocrText") or "").strip()[:24000]
    system_prompt = (
        "You are a careful textbook curriculum structure extractor. Read the supplied table-of-contents page images. "
        "Extract only section headings and page numbers that are visibly supported by the images. Do not invent missing chapters, "
        "numbers, page numbers, video lessons, experiments, tests, or activities. Preserve the order and hierarchy requested. "
        "Ignore headers, footers, index entries, appendices unless they are clearly part of the requested contents. "
        "Within each top-level section, also capture child entries explicitly visible in the contents page when they are clearly activities, "
        "such as a named video, lab/experiment, test/exam, quiz, reading, exercise, or project. Preserve the exact printed activity title. "
        "Classify labs as experiment, exams as test, worksheets/problem sets as exercise, and unclear entries as other. "
        "Do not invent a standard number of videos, experiments, or tests. If no child activities are explicitly listed, return an empty activities array. "
        "If a page number or title is unclear, use null/empty and add a warning. Return only the JSON object that matches the supplied schema."
    )
    user_prompt = (
        f"Read these {len(images)} page image(s) as one continuous table of contents. Extract the top-level '{structure_label}' sections. "
        "For each section, identify its number, exact title, first printed page, and last printed page if explicitly visible or safely inferable "
        "from the next section's start page minus one. Do not mistake chapter numbers in the title or page numbers in the footer for section page numbers. "
        "Use startPage/endPage as integers or null when uncertain. Set confidence to high, medium, or low. For each section, include explicitly printed child activities with exact titles and types; "
        "do not treat page numbers or subheadings as activities unless they are clearly labeled. Add short warnings for ambiguous text, unreadable page numbers, missing pages, "
        "or structure ambiguity. Do not make up a subject name; leave subjectName empty if unknown. "
        f"The requested section label is '{structure_label}'.\n"
    )
    if reference_text:
        user_prompt += "Optional embedded PDF text (secondary cross-check only; the images are authoritative):\n" + reference_text

    chat_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt, "images": images},
        ],
        "format": SCHEMA,
        "stream": False,
        "keep_alive": "10m",
        "options": {"temperature": 0.1, "num_predict": 7000},
    }
    result = http_json(f"{OLLAMA_URL}/api/chat", chat_payload, timeout=1800)
    content = ((result.get("message") or {}).get("content") or result.get("response") or "")
    structured = parse_model_json(content)
    sections = structured.get("sections") or structured.get("chapters") or []
    if not isinstance(sections, list):
        raise RuntimeError("The vision model did not return a list of chapters/sections.")
    clean_sections = []
    warnings = [str(item)[:350] for item in structured.get("warnings", [])[:12] if str(item).strip()] if isinstance(structured.get("warnings"), list) else []
    seen = set()
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            continue
        title = re.sub(r"\s+", " ", str(item.get("title") or "").strip())[:220]
        if not title:
            warnings.append(f"Section {index + 1} did not contain a readable title and was skipped.")
            continue
        number = str(item.get("number") or index + 1).strip()[:40]
        start_page = item.get("startPage")
        end_page = item.get("endPage")
        def valid_page(value):
            try:
                number_value = int(value)
                return number_value if 1 <= number_value <= 10000 else None
            except (TypeError, ValueError):
                return None
        start_page = valid_page(start_page)
        end_page = valid_page(end_page)
        if end_page is not None and start_page is not None and end_page < start_page:
            warnings.append(f"{structure_label} {number}: end page was before start page, so it was left blank.")
            end_page = None
        key = (number.lower(), title.lower(), start_page)
        if key in seen:
            warnings.append(f"Duplicate section '{title}' was skipped.")
            continue
        seen.add(key)
        confidence = str(item.get("confidence") or "medium").lower()
        if confidence not in ("high", "medium", "low"):
            confidence = "medium"
        note = str(item.get("notes") or "").strip()[:300]
        if note and confidence == "low":
            warnings.append(f"{structure_label} {number}: {note}")
        clean_activities = []
        raw_activities = item.get("activities") if isinstance(item.get("activities"), list) else []
        for activity in raw_activities[:40]:
            if not isinstance(activity, dict):
                continue
            activity_title = re.sub(r"\s+", " ", str(activity.get("title") or "").strip())[:180]
            if not activity_title:
                continue
            activity_type = str(activity.get("type") or "other").lower().strip()
            aliases = {"lab": "experiment", "laboratory": "experiment", "exam": "test", "assessment": "test", "worksheet": "exercise", "problem set": "exercise", "assignment": "exercise"}
            activity_type = aliases.get(activity_type, activity_type)
            if activity_type not in ("video", "experiment", "test", "reading", "exercise", "quiz", "project", "other"):
                activity_type = "other"
            activity_confidence = str(activity.get("confidence") or "medium").lower()
            if activity_confidence not in ("high", "medium", "low"):
                activity_confidence = "medium"
            clean_activities.append({"type": activity_type, "title": activity_title, "confidence": activity_confidence})
            if activity_confidence == "low":
                warnings.append(f"{structure_label} {number}: verify detected activity '{activity_title}'.")
        clean_sections.append({
            "number": number,
            "title": title,
            "startPage": start_page,
            "endPage": end_page,
            "confidence": confidence,
            "activities": clean_activities,
        })
    if not clean_sections:
        raise RuntimeError("No usable sections were found in the images. Try clearer photos or select a different vision model.")
    clean_sections.sort(key=lambda item: (item["startPage"] is None, item["startPage"] or 0))
    return {
        "subjectName": str(structured.get("subjectName") or "")[:120],
        "structureLabel": str(structured.get("structureLabel") or structure_label)[:60],
        "sections": clean_sections,
        "warnings": warnings[:12],
        "model": model,
        "stats": {
            "totalDurationSeconds": round((result.get("total_duration") or 0) / 1_000_000_000, 1),
            "promptTokens": result.get("prompt_eval_count"),
            "generatedTokens": result.get("eval_count"),
        },
    }


class DaymarkHandler(SimpleHTTPRequestHandler):
    server_version = "DaymarkLocal/2.5"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stdout.write("[Daymark] " + (fmt % args) + "\n")

    def _is_local_request(self) -> bool:
        host = (self.headers.get("Host") or "").lower()
        return self.client_address[0] in ("127.0.0.1", "::1") and host in (f"127.0.0.1:{PORT}", f"localhost:{PORT}", f"[::1]:{PORT}")

    def _json(self, status: int, value: dict):
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self._is_local_request():
            self._json(403, {"error": "Local requests only."})
            return
        if self.path == "/api/status":
            try:
                version = get_ollama_version()
                self._json(200, {"ok": True, "ollama": True, "version": version, "message": f"Ollama is running (version {version})."})
            except Exception as exc:
                self._json(200, {"ok": True, "ollama": False, "message": str(exc)})
            return
        if self.path == "/api/models":
            try:
                version = get_ollama_version()
                models = get_models()
                self._json(200, {"ok": True, "version": version, "models": models, "visionModels": [m["name"] for m in models if m.get("vision")]})
            except Exception as exc:
                self._json(503, {"ok": False, "error": str(exc), "models": []})
            return
        return super().do_GET()

    def do_POST(self):
        if not self._is_local_request():
            self._json(403, {"error": "Local requests only."})
            return
        origin = (self.headers.get("Origin") or "").lower()
        allowed_origins = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}
        if origin and origin not in allowed_origins:
            self._json(403, {"error": "Requests from other websites are not allowed."})
            return
        if not self.path.startswith("/api/"):
            self._json(404, {"error": "Unknown API route."})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._json(400, {"error": "Invalid request size."})
            return
        if length < 1 or length > MAX_REQUEST_BYTES:
            self._json(413, {"error": "Request is empty or too large. Use fewer or smaller page images."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request must be a JSON object.")
            if self.path == "/api/curriculum/analyze":
                result = analyze_curriculum(payload)
                self._json(200, result)
            else:
                self._json(404, {"error": "Unknown API route."})
        except ValueError as exc:
            self._json(400, {"error": str(exc)})
        except RuntimeError as exc:
            self._json(502, {"error": str(exc)})
        except Exception as exc:
            self._json(500, {"error": f"Unexpected local AI error: {exc}"})


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), DaymarkHandler)
    except OSError as exc:
        print(f"Could not start Daymark on http://{HOST}:{PORT}: {exc}")
        print("Close another Daymark server or set DAYMARK_PORT to a different port.")
        input("Press Enter to close…")
        return
    server.daemon_threads = True
    url = f"http://{HOST}:{PORT}/index.html"
    print("=" * 58)
    print("Daymark V2.5 — Local Ollama AI")
    print(f"Daymark: {url}")
    print(f"Ollama:  {OLLAMA_URL}")
    print("This helper listens on this computer only (127.0.0.1).")
    print("Keep this window open while using Daymark. Press Ctrl+C to stop.")
    print("=" * 58)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("\nStopping Daymark local helper…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
