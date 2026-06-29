from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BENDI_ROOT = ROOT / "AI_learning_bendi"
DB_PATH = BENDI_ROOT / "data" / "learning_machine.db"
RESOURCE_ROOT = BENDI_ROOT / "resources"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "catalog.json"


def rows(conn: sqlite3.Connection, sql: str, args: tuple = ()) -> list[dict]:
    return [dict(row) for row in conn.execute(sql, args).fetchall()]


def read_text_resource(resource_key: str) -> str:
    path = RESOURCE_ROOT / resource_key
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    courses = rows(
        conn,
        """
        SELECT id, stage, subject, title, grade, description, folder_path, cover_path
        FROM courses
        ORDER BY stage, grade, subject, title
        """,
    )
    lessons = rows(
        conn,
        """
        SELECT id, course_id, lesson_order, title, content_path, audio_path, folder_path
        FROM lessons
        ORDER BY course_id, lesson_order
        """,
    )
    questions = rows(
        conn,
        """
        SELECT id, lesson_id, question_text, options_json, answer, explanation,
               question_kind, source_label, source_page, source_type
        FROM questions
        ORDER BY lesson_id,
          CASE question_kind WHEN 'textbook' THEN 1 ELSE 2 END,
          COALESCE(source_page, 999999),
          id
        """,
    )
    resources = rows(
        conn,
        """
        SELECT id, stage, subject, course_id, lesson_id, kind, label, file_name, file_path
        FROM resource_index
        ORDER BY stage, subject, course_id, lesson_id, kind
        """,
    )
    users = rows(
        conn,
        """
        SELECT id, username, full_name, stage, grade, level_label, email, school, bio, role
        FROM users
        ORDER BY id
        """,
    )
    enrollments = rows(
        conn,
        "SELECT user_id, course_id, purchased_at FROM course_enrollments ORDER BY user_id, course_id",
    )
    progress = rows(
        conn,
        "SELECT user_id, lesson_id, status, score, last_answer, updated_at FROM progress ORDER BY user_id, lesson_id",
    )
    attempts = rows(
        conn,
        "SELECT user_id, question_id, lesson_id, answer, correct, updated_at FROM question_attempts ORDER BY user_id, question_id",
    )
    study_time = rows(
        conn,
        "SELECT user_id, lesson_id, seconds, updated_at FROM study_time ORDER BY user_id, lesson_id",
    )

    for lesson in lessons:
        lesson["content"] = read_text_resource(lesson["content_path"])
        lesson["source_page"] = None
        meta_path = RESOURCE_ROOT / lesson["folder_path"] / "meta.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                page = meta.get("source_page")
                lesson["source_page"] = int(page) if page else None
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                lesson["source_page"] = None

    for question in questions:
        try:
            question["options"] = json.loads(question.pop("options_json") or "[]")
        except json.JSONDecodeError:
            question["options"] = []

    payload = {
        "source": "AI_learning_bendi",
        "exported_from": str(DB_PATH),
        "resource_root_hint": str(RESOURCE_ROOT),
        "default_passwords": {
            "cary": "123456",
            "lucy": "123456",
            "1": "1",
        },
        "courses": courses,
        "lessons": lessons,
        "questions": questions,
        "resources": resources,
        "users": users,
        "enrollments": enrollments,
        "progress": progress,
        "question_attempts": attempts,
        "study_time": study_time,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"courses={len(courses)} lessons={len(lessons)} questions={len(questions)} resources={len(resources)}")


if __name__ == "__main__":
    main()
