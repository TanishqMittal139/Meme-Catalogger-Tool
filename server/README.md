# Flask Backend

## Setup

1. Create a virtual environment in `server/` (optional but recommended).
2. Install requirements:

```bash
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

The API runs on `http://127.0.0.1:5000` and exposes:

- `GET /api/memes`
- `GET /api/memes/<id>`
- `POST /api/memes/<id>/reanalyze`
- `POST /api/memes`
- `PUT /api/memes/<id>`
- `DELETE /api/memes/<id>`

## AI metadata

Set `OPENAI_API_KEY` to enable background AI analysis for uploaded memes.

Optional:

- `OPENAI_MODEL` to override the default model (`gpt-4.1-mini`)
- `OLLAMA_BASE_URL` to point at a local Ollama server (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` to choose the local vision model priority list (default `gemma3,llama3.2-vision`)
- `LOCAL_METADATA_FALLBACK=false` to disable the built-in local fallback generator

Fallback order:

1. OpenAI vision, if configured and available
2. Local Ollama vision, if running locally
3. Built-in local image analysis heuristic

For the most accurate no-credit setup, run Ollama locally with `gemma3`.

Accuracy notes:

- `llava:13b` is older and is usually worse at meme OCR and joke understanding than `gemma3`, so it is no longer the default.
- The backend now preprocesses uploaded images into cleaner high-contrast variants before sending them to Ollama, which helps with meme text recognition.
- `StartMemeCatalogger.bat` now checks for the preferred Ollama model and pulls it automatically if it is missing.

## Use your existing SQLite file

Set `MEME_DB_PATH` before starting Flask.

PowerShell example:

```powershell
$env:MEME_DB_PATH="C:\path\to\your\memes.db"
python app.py
```
