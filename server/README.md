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
- `POST /api/memes`
- `PUT /api/memes/<id>`
- `DELETE /api/memes/<id>`

## Use your existing SQLite file

Set `MEME_DB_PATH` before starting Flask.

PowerShell example:

```powershell
$env:MEME_DB_PATH="C:\path\to\your\memes.db"
python app.py
```
