import json
import os
import sqlite3
import threading
from queue import Empty, Queue
from typing import Any

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from ai_metadata import MemeMetadataError, generate_meme_metadata


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("MEME_DB_PATH", os.path.join(BASE_DIR, "memes.db"))

app = Flask(__name__)
_db_initialized = False
_worker_started = False
_meme_queue: Queue[int] = Queue()

FIELD_SOURCE_MAP = {
    "title": "title_source",
    "caption": "caption_source",
    "keywords": "keywords_source",
}


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def row_to_meme(row: sqlite3.Row) -> dict[str, Any]:
    raw_keywords = row["keywords"] or "[]"
    try:
        keywords = json.loads(raw_keywords)
        if not isinstance(keywords, list):
            keywords = []
    except json.JSONDecodeError:
        keywords = []

    return {
        "id": row["id"],
        "title": row["title"],
        "caption": row["caption"] or "",
        "image": row["image"],
        "downloads": row["downloads"] or 0,
        "uploadedBy": row["uploaded_by"] or "unknown",
        "keywords": keywords,
        "aiStatus": row["ai_status"] or "queued",
        "aiError": row["ai_error"],
    }


def init_db() -> None:
    with get_connection() as conn:
        added_ai_columns = False
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                caption TEXT DEFAULT '',
                image TEXT NOT NULL,
                downloads INTEGER NOT NULL DEFAULT 0,
                uploaded_by TEXT DEFAULT 'unknown',
                keywords TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(memes)").fetchall()}
        if "uploaded_by" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN uploaded_by TEXT DEFAULT 'unknown'")
        if "keywords" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]'")
        if "ai_status" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN ai_status TEXT DEFAULT 'queued'")
            added_ai_columns = True
        if "ai_error" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN ai_error TEXT DEFAULT NULL")
            added_ai_columns = True
        if "ai_generated_title" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN ai_generated_title TEXT DEFAULT NULL")
            added_ai_columns = True
        if "ai_generated_caption" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN ai_generated_caption TEXT DEFAULT NULL")
            added_ai_columns = True
        if "ai_generated_keywords" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN ai_generated_keywords TEXT DEFAULT NULL")
            added_ai_columns = True
        if "title_source" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN title_source TEXT NOT NULL DEFAULT 'seed'")
            added_ai_columns = True
        if "caption_source" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN caption_source TEXT NOT NULL DEFAULT 'seed'")
            added_ai_columns = True
        if "keywords_source" not in columns:
            conn.execute("ALTER TABLE memes ADD COLUMN keywords_source TEXT NOT NULL DEFAULT 'seed'")
            added_ai_columns = True

        if added_ai_columns:
            conn.execute(
                """
                UPDATE memes
                SET ai_status = 'completed'
                WHERE ai_status = 'queued'
                  AND ai_generated_title IS NULL
                  AND ai_generated_caption IS NULL
                  AND ai_generated_keywords IS NULL
                """
            )

        meme_count = conn.execute("SELECT COUNT(*) AS count FROM memes").fetchone()["count"]
        if meme_count == 0:
            conn.execute(
                """
                INSERT INTO memes (title, caption, image, downloads, uploaded_by, keywords)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "Sample Meme",
                    "Sample Meme",
                    "https://i.imgflip.com/1ur9b0.jpg",
                    15420,
                    "system",
                    json.dumps(["sample", "starter"]),
                ),
            )

        conn.commit()


def ensure_db_initialized() -> None:
    global _db_initialized
    if _db_initialized:
        return
    init_db()
    _db_initialized = True


def ensure_worker_started() -> None:
    global _worker_started
    if _worker_started:
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return

    worker = threading.Thread(target=process_meme_queue, name="meme-ai-worker", daemon=True)
    worker.start()
    requeue_pending_memes()
    _worker_started = True


def parse_downloads(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("downloads must be a number.") from exc


def normalize_title(value: Any, fallback: str = "Untitled Meme") -> str:
    if not isinstance(value, str):
        value = fallback
    normalized = " ".join(value.split()).strip()
    return normalized or fallback


def normalize_caption(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        value = fallback
    normalized = " ".join(value.split()).strip()
    return normalized or fallback


def normalize_keywords(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized_keywords: list[str] = []
    seen: set[str] = set()

    for keyword in value:
        if not isinstance(keyword, str):
            continue
        cleaned = " ".join(keyword.split()).strip().lstrip("#")
        if not cleaned:
            continue

        lowered = cleaned.lower()
        if lowered in seen:
            continue

        seen.add(lowered)
        normalized_keywords.append(cleaned)

    return normalized_keywords


def queue_meme_for_ai(meme_id: int) -> None:
    _meme_queue.put(meme_id)


def requeue_pending_memes() -> None:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id
            FROM memes
            WHERE ai_status IN ('queued', 'processing')
               OR (
                    ai_status = 'failed'
                    AND ai_generated_title IS NULL
                    AND ai_generated_caption IS NULL
                    AND ai_generated_keywords IS NULL
               )
            ORDER BY id ASC
            """
        ).fetchall()

    for row in rows:
        _meme_queue.put(row["id"])


def process_meme_queue() -> None:
    while True:
        try:
            meme_id = _meme_queue.get(timeout=1)
        except Empty:
            continue

        try:
            process_single_meme(meme_id)
        finally:
            _meme_queue.task_done()


def process_single_meme(meme_id: int) -> None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM memes WHERE id = ?", (meme_id,)).fetchone()
        if row is None:
            return

        conn.execute(
            "UPDATE memes SET ai_status = ?, ai_error = NULL WHERE id = ?",
            ("processing", meme_id),
        )
        conn.commit()

        image = row["image"]

    try:
        metadata = generate_meme_metadata(image)
    except MemeMetadataError as error:
        with get_connection() as conn:
            conn.execute(
                "UPDATE memes SET ai_status = ?, ai_error = ? WHERE id = ?",
                ("failed", str(error), meme_id),
            )
            conn.commit()
        return

    with get_connection() as conn:
        current_row = conn.execute("SELECT * FROM memes WHERE id = ?", (meme_id,)).fetchone()
        if current_row is None:
            return

        update_clauses = [
            "ai_generated_title = ?",
            "ai_generated_caption = ?",
            "ai_generated_keywords = ?",
            "ai_status = ?",
            "ai_error = NULL",
        ]
        update_values: list[Any] = [
            metadata["title"],
            metadata["caption"],
            json.dumps(metadata["keywords"]),
            "completed",
        ]

        for field_name, source_column in FIELD_SOURCE_MAP.items():
            if current_row[source_column] == "user":
                continue
            update_clauses.append(f"{field_name} = ?")
            update_values.append(
                json.dumps(metadata[field_name]) if field_name == "keywords" else metadata[field_name]
            )
            update_clauses.append(f"{source_column} = ?")
            update_values.append("ai")

        update_values.append(meme_id)
        conn.execute(
            f"UPDATE memes SET {', '.join(update_clauses)} WHERE id = ?",
            tuple(update_values),
        )
        conn.commit()


@app.after_request
def apply_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response


@app.before_request
def before_request():
    ensure_db_initialized()
    ensure_worker_started()


@app.errorhandler(Exception)
def handle_unexpected_error(error: Exception):
    if isinstance(error, HTTPException):
        return error
    return jsonify({"error": f"Unexpected server error: {error}"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/memes", methods=["GET"])
def get_memes():
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM memes ORDER BY id DESC").fetchall()
    return jsonify([row_to_meme(row) for row in rows])


@app.route("/api/memes/<int:meme_id>", methods=["GET"])
def get_meme(meme_id: int):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM memes WHERE id = ?", (meme_id,)).fetchone()

    if row is None:
        return jsonify({"error": "Meme not found"}), 404

    return jsonify(row_to_meme(row))


@app.route("/api/memes", methods=["POST"])
def create_memes():
    payload = request.get_json(silent=True) or {}
    memes_payload = payload.get("memes")

    if memes_payload is None:
        memes_payload = [payload]

    if not isinstance(memes_payload, list) or len(memes_payload) == 0:
        return jsonify({"error": "Request body must include meme data."}), 400

    created_memes: list[dict[str, Any]] = []

    try:
        with get_connection() as conn:
            for meme in memes_payload:
                if not isinstance(meme, dict):
                    return jsonify({"error": "Each meme item must be an object."}), 400

                title = normalize_title(meme.get("title"))
                caption = normalize_caption(meme.get("caption"), title)
                image = meme.get("image")
                try:
                    downloads = parse_downloads(meme.get("downloads"))
                except ValueError as error:
                    return jsonify({"error": str(error)}), 400
                uploaded_by = (meme.get("uploadedBy") or "you").strip()
                keywords = normalize_keywords(meme.get("keywords") or [])

                if not image or not isinstance(image, str):
                    return jsonify({"error": "Each meme must include an image string."}), 400

                if not isinstance(keywords, list):
                    return jsonify({"error": "keywords must be an array."}), 400

                cursor = conn.execute(
                    """
                    INSERT INTO memes (
                        title,
                        caption,
                        image,
                        downloads,
                        uploaded_by,
                        keywords,
                        ai_status,
                        ai_error,
                        title_source,
                        caption_source,
                        keywords_source
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        title,
                        caption,
                        image,
                        downloads,
                        uploaded_by,
                        json.dumps(keywords),
                        "queued",
                        None,
                        "seed",
                        "seed",
                        "seed",
                    ),
                )
                meme_id = cursor.lastrowid
                row = conn.execute("SELECT * FROM memes WHERE id = ?", (meme_id,)).fetchone()
                created_memes.append(row_to_meme(row))

            conn.commit()
    except sqlite3.DatabaseError as error:
        return jsonify({"error": f"Database error while creating memes: {error}"}), 500

    for meme in created_memes:
        queue_meme_for_ai(meme["id"])

    return jsonify({"memes": created_memes}), 201


@app.route("/api/memes/<int:meme_id>", methods=["PUT"])
def update_meme(meme_id: int):
    payload = request.get_json(silent=True) or {}
    allowed_fields = {
        "title": "title",
        "caption": "caption",
        "image": "image",
        "downloads": "downloads",
        "uploadedBy": "uploaded_by",
        "keywords": "keywords",
    }

    update_clauses: list[str] = []
    update_values: list[Any] = []

    for payload_key, column_name in allowed_fields.items():
        if payload_key not in payload:
            continue

        value = payload[payload_key]
        if payload_key == "keywords":
            if not isinstance(value, list):
                return jsonify({"error": "keywords must be an array."}), 400
            value = json.dumps(normalize_keywords(value))

        if payload_key == "downloads":
            try:
                value = parse_downloads(value)
            except ValueError as error:
                return jsonify({"error": str(error)}), 400

        if payload_key == "title":
            value = normalize_title(value)

        if payload_key == "caption":
            fallback_title = normalize_title(payload.get("title"))
            value = normalize_caption(value, fallback_title)

        update_clauses.append(f"{column_name} = ?")
        update_values.append(value)

        source_column = FIELD_SOURCE_MAP.get(payload_key)
        if source_column:
            update_clauses.append(f"{source_column} = ?")
            update_values.append("user")

    if not update_clauses:
        return jsonify({"error": "No valid fields provided."}), 400

    with get_connection() as conn:
        row = conn.execute("SELECT id FROM memes WHERE id = ?", (meme_id,)).fetchone()
        if row is None:
            return jsonify({"error": "Meme not found"}), 404

        update_values.append(meme_id)
        conn.execute(
            f"UPDATE memes SET {', '.join(update_clauses)} WHERE id = ?",
            tuple(update_values),
        )
        updated = conn.execute("SELECT * FROM memes WHERE id = ?", (meme_id,)).fetchone()
        conn.commit()

    return jsonify(row_to_meme(updated))


@app.route("/api/memes/<int:meme_id>", methods=["DELETE"])
def delete_meme(meme_id: int):
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM memes WHERE id = ?", (meme_id,))
        conn.commit()

    if cursor.rowcount == 0:
        return jsonify({"error": "Meme not found"}), 404

    return "", 204


if __name__ == "__main__":
    ensure_db_initialized()
    ensure_worker_started()
    flask_port = int(os.getenv("FLASK_PORT", "5000"))
    app.run(host="127.0.0.1", port=flask_port, debug=True)
