# Daymark V2.6 — Study Breaks

Daymark is a local-first homeschool planner built with HTML, CSS, and JavaScript. V2.5 replaces the paid cloud AI curriculum-import connection with a local Python bridge to Ollama. Curriculum images are processed by an installed local vision model on this computer; no API key or paid AI endpoint is used by the importer. V2.6 adds temporary, customizable subject-level study breaks without overwriting the normal schedule.

## Start Daymark

1. Extract the complete ZIP to a normal folder on your computer.
2. Make sure **Ollama** is installed and running. Its local API should be available at `http://127.0.0.1:11434` (the Ollama Windows app normally starts this in the background).
3. Make sure **Python 3.10 or newer** is installed. The helper uses only Python's standard library; no `pip install` step is needed.
4. Double-click **`Start-Daymark.bat`**.
5. A terminal window opens and Daymark opens in your browser at `http://127.0.0.1:8765`. Keep the terminal window open while using Daymark. Close it or press Ctrl+C when finished.

Do not open `index.html` directly from File Explorer for AI importing. The `file://` page cannot reach the local Python bridge. Always launch with `Start-Daymark.bat`.

### If Python is not found

Open Command Prompt and run:

```bat
py -3 --version
```

If the command is unavailable or reports a version older than 3.10, install a current Python 3 release from the official Python website, then double-click `Start-Daymark.bat` again. The app itself needs no Python packages.

## Connect your installed Ollama model

1. Open **Subjects → Import curriculum**.
2. Expand **Local AI connection — Ollama**.
3. Daymark checks the local Ollama service and asks it which models are installed.
4. Select a model marked **vision**. Your saved model selection is remembered in this browser.
5. Check the local-image processing consent box and click **Analyze page images with AI**.

The helper discovers installed models through Ollama's local `/api/tags` and `/api/show` endpoints, and uses the model capability metadata to identify vision support. It does not guess that every Qwen model supports images.

### Important note about a “Qwen 27B” installation

Some Qwen 27B models are text-only. A text-only model cannot inspect uploaded images, even if it is good at reading text pasted into a prompt. Daymark will only show models that Ollama reports as vision-capable (with a conservative model-name fallback for older Ollama versions). If your Qwen 27B model does not appear in the vision list, check the exact model tag shown by `ollama list`; you may have a text-only build. You would need an already-installed vision-capable model for image import. Daymark will not download a model automatically.

## Import a curriculum from images or PDF

1. Open **Subjects → Import curriculum**.
2. Upload one or more JPG, PNG, WebP, or PDF pages. Up to 20 page images are accepted per analysis.
3. Choose a section type such as Chapter, Lesson, Unit, Topic, or a custom label.
4. Choose your installed vision model and approve local image processing.
5. Click **Analyze page images with AI**. The model reads the page images directly; OCR is not run first.
6. Review the detected titles and page ranges. Correct uncertain entries, add/remove sections, and select an activity template.
7. Import into an existing subject or create a new one. You can schedule the generated activities immediately or leave them unscheduled.

AI extraction is a first draft, not a guarantee. Verify page numbers and titles against the book before importing. A table of contents generally cannot reveal how many videos, experiments, or tests belong to each chapter; use a saved activity template and per-chapter experiment counts for those details. If you also have a lab list or lesson plan, import those pages separately and review them before adding their items.

### PDF processing

PDF pages are rendered to images in the browser using PDF.js, then sent to the local Python helper. The PDF content is not uploaded to a cloud AI provider. The PDF.js library is loaded from a CDN when needed, so the first PDF import requires an internet connection to download that library. Image-only imports can be processed without an internet connection once Ollama and its model are installed and running.

## What the Python helper does

- Serves the HTML/CSS/JS app on `127.0.0.1:8765` so the browser can safely reach the local bridge.
- Checks Ollama at `127.0.0.1:11434` and lists installed models.
- Checks model capabilities and prevents sending images to a model that does not advertise vision support.
- Sends base64 page images to Ollama's local `/api/chat` endpoint and requests structured JSON output.
- Validates and normalizes the returned chapter/lesson titles and page ranges before returning them to Daymark.

The helper binds to loopback (`127.0.0.1`) only. It does not expose an internet-facing server, does not add CORS access for other websites, filters out Ollama cloud models, and does not store uploaded images on disk. Images are held in memory for the analysis request and passed to the local Ollama service. It requires Python 3.10 or newer and no third-party Python packages.

## Troubleshooting

**“Daymark local helper is not running”**
- Close any directly opened `index.html` tab.
- Double-click `Start-Daymark.bat` and use the browser tab it opens.
- Keep the terminal window running.

**“Could not reach Ollama”**
- Open the Ollama desktop app and wait for it to start.
- In Command Prompt, run `ollama list` to confirm your models are installed.
- Reopen the import wizard and click **Test connection** or **Refresh model list**.

**Your Qwen model is installed but does not appear**
- It may be a text-only model variant. Check the exact name using `ollama list`.
- Daymark filters for models reporting vision capability. A model's parameter count (for example, 27B) does not by itself mean it can accept images.

**Model takes a long time or times out**
- The first request may need to load a large model into memory. Give it time.
- Try one or two pages first, then smaller batches.
- Close other demanding applications if the computer is low on memory.

**Port 8765 is already in use**
- Close another Daymark local-helper window and relaunch `Start-Daymark.bat`.

## Data and privacy

Planner data remains in browser storage as before. Export a backup from **Settings → Data & Backups** before replacing an older version or moving to another browser. The local AI importer sends selected page images to the Ollama server on this computer (`127.0.0.1`), not to OpenAI or another cloud model service. Models tagged as Ollama cloud models are intentionally excluded from the importer. Model downloads and Ollama software updates are separate actions managed by Ollama; Daymark does not download models automatically.

## Project files

- `index.html` — app structure
- `styles.css` — visual design, responsive layout, and print styles
- `app.js` — planner, curriculum import UI, local AI client, scheduling, tracking, storage, and reports
- `serve.py` — standard-library local web server and Ollama bridge
- `Start-Daymark.bat` — Windows launcher
- `tests/` — local helper unit tests



## V2.6 — Temporary subject study breaks

Start a customizable study break from any subject card. Choose a name, start date, number of consecutive calendar days (1–365), and daily study time (1–600 minutes). Daymark displays one entry per calendar day, including weekends and days off, and temporarily replaces that subject's generated targets, dated curriculum activities, and manual tasks for the covered dates. Other subjects and personal tasks remain visible. The original schedule is not edited or deleted; it reappears when the break expires or when you end it early. Study-break sessions can be marked complete and are recorded in the activity log.

Run the built-in study-break tests with `npm test` (Node.js is required for the test command; the planner itself remains a browser app).

## Current features carried forward

Daymark retains the V2.1–V2.4 planner features: subject management, chapter/lesson/activity structures, subject priorities, workload calculations, a subject-by-day weekly calendar, movable assignments, milestones, logs, notes, weekly review, CSV export, blank/planned/completed printouts, settings customization, and local backups.
