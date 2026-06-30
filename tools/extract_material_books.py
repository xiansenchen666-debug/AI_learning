from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.oxml.ns import qn
from pypdf import PdfReader


SUPPORTED_SUFFIXES = {".docx", ".doc", ".pdf"}
EXCLUDED_SOURCE_DIRECTORIES = {
    "1_小学全科全年级资料大全集【超完整版】",
}
SUBJECTS = (
    "语文",
    "数学",
    "英语",
    "物理",
    "化学",
    "生物",
    "地理",
    "历史",
    "道德与法治",
    "道法",
    "政治",
)
IMAGE_DEPENDENT_RE = re.compile(
    r"(如图|下图|上图|左图|右图|图中|读图|看图|观察图|示意图|漫画|图示|"
    r"根据图|结合图|图①|图②|图③|图片|照片)"
)
QUESTION_RE = re.compile(r"^\s*(\d{1,3})[.．、]\s*(.+)")
ANSWER_ITEM_RE = re.compile(r"(?<!\d)(\d{1,3})[.．、]\s*")
OPTION_RE = re.compile(r"(?<![A-Za-z])([A-H])(?:[.．、]|\s*\|\s*)\s*")
ANSWER_HEADING_RE = re.compile(
    r"^\s*(?:(?:参考)?(?:答案|解析|答案解析|参考答案)\s*[：:]?"
    r"|知能演练[·•]提升)\s*$"
)
SECTION_RE = re.compile(
    r"^\s*([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|[一二三四五六七八九十]+)[.、]\s*(.*)"
)
INLINE_ANSWER_RE = re.compile(r"^\s*答案\s*[：:]\s*(.+)")
INLINE_EXPLANATION_RE = re.compile(r"^\s*(?:解析|解)\s*[：:]\s*(.*)")
ANSWER_VALUE_RE = re.compile(
    r"^\s*([A-H](?:\s*[,，、/]\s*[A-H])*)"
    r"(?:\s+|[。；;，,])?(.*)$"
)


@dataclass(frozen=True)
class BookSource:
    key: str
    title: str
    relative_path: str
    order_hint: str
    files: tuple[Path, ...]
    source_kind: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract learning materials into one reviewable JSON file per book.",
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--match", default="")
    parser.add_argument("--skip-pdf", action="store_true")
    return parser.parse_args()


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u3000", " ")
    value = re.sub(r"[\ud800-\udfff]", "\ufffd", value)
    value = value.replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def safe_relative(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def stable_id(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def infer_metadata(value: str) -> dict[str, str]:
    if "小学" in value or "小升初" in value:
        stage = "小学"
    elif "高中" in value or "高考" in value:
        stage = "高中"
    elif "初中" in value or "中考" in value:
        stage = "初中"
    else:
        stage = "未分类"

    subject = next((item for item in SUBJECTS if item in value), "综合")
    if subject == "道法":
        subject = "道德与法治"

    grade_patterns = (
        r"(一年级|二年级|三年级|四年级|五年级|六年级|"
        r"七年级|八年级|九年级)(?:上册|下册|全一册)?",
        r"(小升初|中考|高考)",
    )
    grade = "未分类"
    for pattern in grade_patterns:
        match = re.search(pattern, value)
        if match:
            grade = match.group(0)
            break

    if any(word in value for word in ("真题", "试卷", "测评", "考试")):
        material_type = "exam"
    elif any(word in value for word in ("知识点", "知识手册", "考点", "精讲")):
        material_type = "knowledge"
    else:
        material_type = "practice"

    return {
        "stage": stage,
        "grade": grade,
        "subject": subject,
        "material_type": material_type,
    }


def discover_books(source_root: Path) -> list[BookSource]:
    extracted_root = source_root / "_解压资料"
    books: list[BookSource] = []

    if extracted_root.exists():
        source_collections = [
            item
            for item in source_root.iterdir()
            if item.is_dir() and not item.name.startswith("_")
        ]
        for collection in sorted(item for item in extracted_root.iterdir() if item.is_dir()):
            matched_collection = next(
                (
                    item.name
                    for item in source_collections
                    if item.name.endswith(collection.name)
                ),
                collection.name,
            )
            for subject_dir in sorted(item for item in collection.iterdir() if item.is_dir()):
                for book_dir in sorted(item for item in subject_dir.iterdir() if item.is_dir()):
                    files = tuple(
                        sorted(
                            item
                            for item in book_dir.rglob("*")
                            if item.is_file()
                            and item.suffix.lower() in SUPPORTED_SUFFIXES
                            and not item.name.startswith("~$")
                        )
                    )
                    if not files:
                        continue
                    relative = safe_relative(book_dir, source_root)
                    books.append(
                        BookSource(
                            key=f"archive:{relative}",
                            title=book_dir.name,
                            relative_path=relative,
                            order_hint=(
                                f"{matched_collection}/{subject_dir.name}/{book_dir.name}"
                            ),
                            files=files,
                            source_kind="extracted_archive",
                        )
                    )

    excluded_roots = {
        "_解压资料",
        "_转换DOCX",
        "_网站JSON",
        ".accelerate",
    }
    for item in sorted(source_root.rglob("*")):
        if not item.is_file() or item.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue
        if item.name.startswith("~$"):
            continue
        relative_parts = item.relative_to(source_root).parts
        if relative_parts and relative_parts[0] in (
            excluded_roots | EXCLUDED_SOURCE_DIRECTORIES
        ):
            continue
        relative = safe_relative(item, source_root)
        books.append(
            BookSource(
                key=f"file:{relative}",
                title=item.stem,
                relative_path=relative,
                order_hint=relative,
                files=(item,),
                source_kind="standalone_file",
            )
        )

    books.sort(key=lambda item: item.order_hint)
    return books


def paragraph_text(element) -> str:
    parts: list[str] = []
    for node in element.iter():
        local_name = node.tag.rsplit("}", 1)[-1]
        if local_name == "t" and node.text:
            parts.append(node.text)
        elif local_name == "tab":
            parts.append("\t")
        elif local_name in {"br", "cr"}:
            parts.append("\n")
    return clean_text("".join(parts))


def extract_docx(path: Path) -> dict:
    document = Document(str(path))
    body = document.element.body
    lines: list[str] = []
    table_count = 0

    for child in body.iterchildren():
        local_name = child.tag.rsplit("}", 1)[-1]
        if local_name == "p":
            text = paragraph_text(child)
            if text:
                lines.extend(part for part in text.splitlines() if part.strip())
        elif local_name == "tbl":
            table_count += 1
            for row in child.findall(qn("w:tr")):
                cells = []
                for cell in row.findall(qn("w:tc")):
                    text = paragraph_text(cell)
                    if text:
                        cells.append(text.replace("\n", " / "))
                if cells:
                    lines.append(" | ".join(cells))

    xml = document.element.xml
    image_count = len(document.inline_shapes) + xml.count("<w:drawing")
    formula_count = xml.count("<m:oMath")
    return {
        "status": "ok",
        "lines": lines,
        "page_count": None,
        "table_count": table_count,
        "omitted_image_count": image_count,
        "formula_count": formula_count,
        "warnings": [],
    }


def extract_pdf(path: Path) -> dict:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        return {
            "status": "skipped",
            "reason": "pdf_open_failed",
            "detail": str(exc),
        }

    page_texts: list[str] = []
    low_text_pages = 0
    extraction_errors = 0
    for page in reader.pages:
        try:
            text = clean_text(page.extract_text() or "")
        except Exception:
            text = ""
            extraction_errors += 1
        page_texts.append(text)
        if len(re.sub(r"\s+", "", text)) < 40:
            low_text_pages += 1

    page_count = len(page_texts)
    text_chars = sum(len(re.sub(r"\s+", "", item)) for item in page_texts)
    low_text_ratio = low_text_pages / max(page_count, 1)
    if text_chars < 120 or low_text_ratio >= 0.7:
        return {
            "status": "skipped",
            "reason": "scanned_or_image_pdf",
            "page_count": page_count,
            "text_chars": text_chars,
            "low_text_page_ratio": round(low_text_ratio, 3),
        }

    lines: list[str] = []
    for page_number, text in enumerate(page_texts, start=1):
        if text:
            lines.append(f"[[PAGE {page_number}]]")
            lines.extend(part for part in text.splitlines() if part.strip())

    warnings = []
    if extraction_errors:
        warnings.append(f"{extraction_errors} page(s) failed text extraction")
    return {
        "status": "ok",
        "lines": lines,
        "page_count": page_count,
        "table_count": 0,
        "omitted_image_count": 0,
        "formula_count": 0,
        "warnings": warnings,
    }


def split_options(lines: list[str]) -> tuple[str, list[str]]:
    combined = "\n".join(lines)
    matches = list(OPTION_RE.finditer(combined))
    if not matches:
        return clean_text(combined), []

    stem = clean_text(combined[: matches[0].start()])
    options = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(combined)
        value = clean_text(combined[match.end() : end])
        if value:
            options.append(f"{match.group(1)}. {value}")
    return stem, options


def parse_answer_value(value: str) -> tuple[str, str]:
    value = clean_text(value)
    match = ANSWER_VALUE_RE.match(value)
    if not match:
        return "", value
    answer = re.sub(r"\s+", "", match.group(1)).replace("，", ",").replace("、", ",")
    explanation = clean_text(match.group(2))
    return answer, explanation


def numbered_fragments(value: str) -> list[tuple[str, str]]:
    matches = list(ANSWER_ITEM_RE.finditer(value))
    if not matches:
        return []
    fragments = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(value)
        fragments.append((match.group(1), clean_text(value[match.end() : end])))
    return fragments


def parse_answer_section(
    lines: list[str],
) -> dict[tuple[str, str], dict[str, str]]:
    entries: dict[tuple[str, str], list[str]] = {}
    current_key: tuple[str, str] | None = None
    current_section = ""
    for line in lines:
        section_match = SECTION_RE.match(line)
        content = line
        if section_match:
            current_section = section_match.group(1)
            content = section_match.group(2)

        fragments = numbered_fragments(content)
        if fragments:
            for number, value in fragments:
                current_key = (current_section, number)
                entries.setdefault(current_key, []).append(value)
        elif current_key and content:
            entries[current_key].append(content)

    answers: dict[tuple[str, str], dict[str, str]] = {}
    for key, values in entries.items():
        answer, explanation = parse_answer_value("\n".join(values))
        answers[key] = {"answer": answer, "explanation": explanation}
    return answers


def question_kind(stem: str, options: list[str]) -> str:
    if options:
        return "choice"
    if "判断" in stem and any(value in stem for value in ("正确", "错误", "对错")):
        return "true_false"
    if any(value in stem for value in ("填空", "　　　　", "______", "____")):
        return "fill_blank"
    return "open"


def parse_questions(lines: list[str], omitted_image_count: int) -> tuple[list[dict], list[str]]:
    answer_index = len(lines)
    seen_question = False
    for index, line in enumerate(lines):
        seen_question = seen_question or bool(QUESTION_RE.match(line))
        if seen_question and ANSWER_HEADING_RE.match(line):
            answer_index = index
            break
    body_lines = lines[:answer_index]
    answer_map = parse_answer_section(lines[answer_index + 1 :])

    raw_questions: list[tuple[str, str, list[str]]] = []
    knowledge_lines: list[str] = []
    current_section = ""
    current_number = ""
    current_lines: list[str] = []

    for line in body_lines:
        if line.startswith("[[PAGE "):
            continue
        section_match = SECTION_RE.match(line)
        if section_match:
            if current_number:
                raw_questions.append(
                    (current_section, current_number, current_lines)
                )
                current_number = ""
                current_lines = []
            current_section = section_match.group(1)
            heading = section_match.group(2)
            if heading:
                knowledge_lines.append(line)
            continue
        match = QUESTION_RE.match(line)
        if match:
            if current_number:
                raw_questions.append(
                    (current_section, current_number, current_lines)
                )
            current_number = match.group(1)
            current_lines = [match.group(2)]
        elif current_number:
            current_lines.append(line)
        else:
            knowledge_lines.append(line)
    if current_number:
        raw_questions.append((current_section, current_number, current_lines))

    questions: list[dict] = []
    for sequence, (section, number, raw_lines) in enumerate(
        raw_questions,
        start=1,
    ):
        inline_answer = ""
        inline_explanation: list[str] = []
        question_lines: list[str] = []
        explanation_mode = False

        for line in raw_lines:
            answer_match = INLINE_ANSWER_RE.match(line)
            explanation_match = INLINE_EXPLANATION_RE.match(line)
            if answer_match:
                inline_answer, extra = parse_answer_value(answer_match.group(1))
                if extra:
                    inline_explanation.append(extra)
                explanation_mode = True
            elif explanation_match:
                if explanation_match.group(1):
                    inline_explanation.append(explanation_match.group(1))
                explanation_mode = True
            elif explanation_mode:
                inline_explanation.append(line)
            else:
                question_lines.append(line)

        stem, options = split_options(question_lines)
        mapped = answer_map.get((section, number)) or answer_map.get(
            ("", number),
            {},
        )
        answer = inline_answer or mapped.get("answer", "")
        explanation = clean_text(
            "\n".join(inline_explanation) or mapped.get("explanation", "")
        )
        kind = question_kind(stem, options)
        if not answer and explanation and kind != "choice":
            answer = explanation
            explanation = ""

        review_reasons = []
        whole_question = "\n".join(raw_lines)
        if IMAGE_DEPENDENT_RE.search(whole_question):
            review_reasons.append("depends_on_omitted_image")
        if options == [] and re.search(r"[（(]\s*[　 ]*\s*[）)]", stem):
            review_reasons.append("choice_options_missing")
        if not answer:
            review_reasons.append("answer_not_detected")
        if omitted_image_count and not stem:
            review_reasons.append("content_may_be_image_only")

        questions.append(
            {
                "id": sequence,
                "source_section": section,
                "source_number": number,
                "kind": kind,
                "stem": stem,
                "options": options,
                "answer": answer,
                "explanation": explanation,
                "needs_review": bool(review_reasons),
                "review_reasons": review_reasons,
            }
        )

    return questions, knowledge_lines


def lesson_title(path: Path) -> str:
    return path.stem.replace("_", " ").strip()


def extract_document(path: Path, source_root: Path, skip_pdf: bool) -> dict:
    suffix = path.suffix.lower()
    relative = safe_relative(path, source_root)
    base = {
        "title": lesson_title(path),
        "source_file": relative,
        "source_format": suffix.lstrip("."),
    }

    converted_docx = source_root / "_转换DOCX" / Path(relative).with_suffix(".docx")
    if suffix == ".doc" and not converted_docx.exists():
        return {
            **base,
            "status": "skipped",
            "skip_reason": "legacy_doc_requires_conversion",
        }
    if suffix == ".pdf" and skip_pdf:
        return {**base, "status": "skipped", "skip_reason": "pdf_disabled"}

    try:
        if suffix == ".doc":
            extracted = extract_docx(converted_docx)
            extracted["warnings"].append("extracted_from_temporary_docx_conversion")
        else:
            extracted = extract_docx(path) if suffix == ".docx" else extract_pdf(path)
    except Exception as exc:
        return {
            **base,
            "status": "skipped",
            "skip_reason": "extract_failed",
            "error": str(exc),
        }

    if extracted["status"] != "ok":
        return {
            **base,
            "status": "skipped",
            "skip_reason": extracted.get("reason", "unknown"),
            "details": {
                key: value
                for key, value in extracted.items()
                if key not in {"status", "reason", "lines"}
            },
        }

    questions, knowledge_lines = parse_questions(
        extracted["lines"],
        extracted["omitted_image_count"],
    )
    accepted_questions = [
        item for item in questions if not item["needs_review"]
    ]
    review_questions = [item for item in questions if item["needs_review"]]
    return {
        **base,
        "status": "ok",
        "page_count": extracted["page_count"],
        "table_count": extracted["table_count"],
        "formula_count": extracted["formula_count"],
        "omitted_image_count": extracted["omitted_image_count"],
        "warnings": extracted["warnings"],
        "knowledge_text": clean_text("\n".join(knowledge_lines)),
        "questions": accepted_questions,
        "review_questions": review_questions,
        "statistics": {
            "accepted_question_count": len(accepted_questions),
            "review_question_count": len(review_questions),
            "answer_detected_count": sum(
                1 for item in questions if item["answer"]
            ),
        },
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def output_name(book: BookSource) -> str:
    book_hash = stable_id(book.key)
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", book.title).strip(" .")
    cleaned = cleaned[:70] or "book"
    return f"{cleaned}__{book_hash}.json"


def main() -> int:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = args.output.resolve()
    if not source_root.exists():
        print(f"Source directory does not exist: {source_root}", file=sys.stderr)
        return 2

    books = discover_books(source_root)
    if args.match:
        books = [
            book
            for book in books
            if args.match.casefold()
            in f"{book.title}/{book.relative_path}".casefold()
        ]
    if args.limit > 0:
        books = books[: args.limit]

    manifest_entries = []
    skipped_documents = []
    review_entries = []
    totals = {
        "books": 0,
        "documents": 0,
        "accepted_questions": 0,
        "review_questions": 0,
        "skipped_documents": 0,
    }

    books_root = output_root / "books"
    for index, book in enumerate(books, start=1):
        metadata = infer_metadata(f"{book.relative_path}/{book.title}")
        lessons = []
        for path in book.files:
            lesson = extract_document(path, source_root, args.skip_pdf)
            lessons.append(lesson)
            totals["documents"] += 1
            if lesson["status"] == "skipped":
                totals["skipped_documents"] += 1
                skipped_documents.append(
                    {
                        "book": book.title,
                        "source_file": lesson["source_file"],
                        "reason": lesson["skip_reason"],
                    }
                )
                continue

            stats = lesson["statistics"]
            totals["accepted_questions"] += stats["accepted_question_count"]
            totals["review_questions"] += stats["review_question_count"]
            for question in lesson["review_questions"]:
                review_entries.append(
                    {
                        "book": book.title,
                        "lesson": lesson["title"],
                        "source_file": lesson["source_file"],
                        "source_number": question["source_number"],
                        "reasons": question["review_reasons"],
                    }
                )

        book_id = stable_id(book.key)
        book_payload = {
            "schema_version": 1,
            "book": {
                "id": book_id,
                "title": book.title,
                "source_kind": book.source_kind,
                "source_path": book.relative_path,
                **metadata,
            },
            "content_policy": {
                "images_included": False,
                "scanned_pdf_ocr_enabled": False,
                "review_questions_excluded_from_student_content": True,
            },
            "lessons": lessons,
            "statistics": {
                "document_count": len(lessons),
                "accepted_question_count": sum(
                    item.get("statistics", {}).get("accepted_question_count", 0)
                    for item in lessons
                ),
                "review_question_count": sum(
                    item.get("statistics", {}).get("review_question_count", 0)
                    for item in lessons
                ),
                "skipped_document_count": sum(
                    1 for item in lessons if item["status"] == "skipped"
                ),
            },
        }
        file_name = output_name(book)
        shard = book_id[:2]
        output_path = books_root / shard / file_name
        write_json(output_path, book_payload)
        totals["books"] += 1
        manifest_entries.append(
            {
                "id": book_id,
                "title": book.title,
                "stage": metadata["stage"],
                "grade": metadata["grade"],
                "subject": metadata["subject"],
                "material_type": metadata["material_type"],
                "json_path": output_path.relative_to(output_root).as_posix(),
                **book_payload["statistics"],
            }
        )
        print(f"[{index}/{len(books)}] {book.title}")

    generated_at = datetime.now(timezone.utc).isoformat()
    write_json(
        output_root / "manifest.json",
        {
            "schema_version": 1,
            "generated_at": generated_at,
            "source_root": str(source_root),
            "totals": totals,
            "books": manifest_entries,
        },
    )
    write_json(
        output_root / "reports" / "skipped_documents.json",
        {
            "generated_at": generated_at,
            "count": len(skipped_documents),
            "items": skipped_documents,
        },
    )
    write_json(
        output_root / "reports" / "review_questions.json",
        {
            "generated_at": generated_at,
            "count": len(review_entries),
            "items": review_entries,
        },
    )
    print(json.dumps(totals, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
