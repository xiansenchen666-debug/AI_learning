#!/usr/bin/env python3
"""Build a non-commercial/open K12 catalog from public datasets.

This script intentionally operates only inside AI_learning_deno_cloud:
- rewrites data/catalog.json
- rewrites data/open_k12_sources.json
- rewrites data/textbooks/*.json

It does not read from or delete AI_learning_bendi.
"""

from __future__ import annotations

import json
import re
import shutil
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
TEXTBOOK_DIR = DATA_DIR / "textbooks"

HG_BASE = "https://huggingface.co/datasets/lhpku20010120/K12-KGraph/resolve/main"
KGRAPH_LICENSE = "CC BY-NC-SA 4.0"

SUBJECT_FILES = {
    "数学": f"{HG_BASE}/K12-KGraph/subject_specific_KG/math.json",
    "物理": f"{HG_BASE}/K12-KGraph/subject_specific_KG/physics.json",
    "化学": f"{HG_BASE}/K12-KGraph/subject_specific_KG/chemistry.json",
    "生物": f"{HG_BASE}/K12-KGraph/subject_specific_KG/biology.json",
}

AFTERCLASS_FILES = [
    "chemistry_9a_rjb.json",
    "chemistry_9b_rjb.json",
    "chemistry_highschool_rjb_bx1.json",
    "chemistry_highschool_rjb_bx2.json",
    "chemistry_highschool_rjb_xzxbx1.json",
    "chemistry_highschool_rjb_xzxbx2.json",
    "chemistry_highschool_rjb_xzxbx3.json",
    "math_7a_rjb.json",
    "math_7b_rjb.json",
    "math_8a_rjb.json",
    "math_8b_rjb.json",
    "math_9a_rjb.json",
    "math_9b_rjb.json",
    "math_highschool_rjb_bx1.json",
    "math_highschool_rjb_bx2.json",
]

PUBLIC_SOURCES = [
    {
        "id": "k12_kgraph",
        "name": "K12-KGraph",
        "url": "https://huggingface.co/datasets/lhpku20010120/K12-KGraph",
        "license": KGRAPH_LICENSE,
        "usage": "按人教版 K12 教材整理知识图谱、知识点、技能、实验与部分课后练习；适合非商业知识点/题库底座。",
    },
    {
        "id": "e_eval",
        "name": "E-EVAL",
        "url": "https://huggingface.co/datasets/E-EVAL/E-EVAL",
        "license": "Apache-2.0",
        "usage": "小学、初中、高中多学科选择题，可作为语文/英语/历史/地理/政治等题库补充源。",
    },
    {
        "id": "cmm_math",
        "name": "CMM-Math",
        "url": "https://huggingface.co/datasets/ecnu-icalk/cmm-math",
        "license": "BSD-3-Clause",
        "usage": "1-12 年级中文数学题，含解析和图文题；适合作为数学题库补充源。",
    },
    {
        "id": "cmath",
        "name": "CMATH",
        "url": "https://huggingface.co/datasets/weitianwen/cmath",
        "license": "CC BY 4.0",
        "usage": "小学数学应用题数据集，适合小学数学题库补充。",
    },
    {
        "id": "eduqs",
        "name": "EduQS",
        "url": "https://huggingface.co/datasets/chaosY/EduQS",
        "license": "Apache-2.0",
        "usage": "初高中多模态教育题库，含答案、解析、知识点与图片字段；适合初高中理科/文综题库补充。",
    },
    {
        "id": "ceval",
        "name": "C-Eval",
        "url": "https://github.com/hkust-nlp/ceval",
        "license": "CC BY-NC-SA 4.0",
        "usage": "初高中到大学多学科选择题评测集；适合非商业测评与补充题。",
    },
    {
        "id": "m3ke",
        "name": "M3KE",
        "url": "https://github.com/tjunlp-lab/M3KE",
        "license": "请以仓库 LICENSE 为准",
        "usage": "小学到高中多学科四选一题目；适合作为补充题库来源。",
    },
    {
        "id": "race",
        "name": "RACE",
        "url": "http://www.cs.cmu.edu/~glai1/data/race/",
        "license": "请以数据集页面为准",
        "usage": "中国初高中英语阅读理解数据；适合英语阅读题库补充。",
    },
]

CN_NUMBERS = {
    1: "一",
    2: "二",
    3: "三",
    4: "四",
    5: "五",
    6: "六",
    7: "七",
    8: "八",
    9: "九",
}

SUBJECT_EN_TO_CN = {
    "math": "数学",
    "physics": "物理",
    "chemistry": "化学",
    "biology": "生物",
}


def fetch_json(url: str) -> Any:
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def safe_recreate_dir(path: Path) -> None:
    resolved = path.resolve()
    root = ROOT.resolve()
    if root not in [resolved, *resolved.parents]:
        raise RuntimeError(f"Refusing to delete outside project root: {resolved}")
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def item_prefix(item_id: str) -> str | None:
    match = re.match(r"^(.*)_(?:cpt|skl|exe|exp)\d+$", item_id)
    return canonical_prefix(match.group(1)) if match else None


def canonical_prefix(prefix: str) -> str:
    match = re.match(r"^(math|chemistry)_highschool_rjb_(.+)$", prefix)
    if match:
        return f"{match.group(1)}_{match.group(2)}_rjb"
    return prefix


def clean_question(raw: dict[str, Any], fallback_prefix: str) -> dict[str, Any]:
    props = raw.get("properties") or {}
    links = raw.get("links") or {}
    qid = raw.get("id") or props.get("id") or f"{fallback_prefix}_q"
    return {
        "id": qid,
        "type": props.get("type") or raw.get("type") or "练习题",
        "stem": props.get("stem") or raw.get("stem") or raw.get("name") or "",
        "answer": props.get("answer") or raw.get("answer") or "",
        "analysis": props.get("analysis") or raw.get("analysis") or "",
        "difficulty": props.get("difficulty") or raw.get("difficulty"),
        "knowledge_points": links.get("concept_names") or [],
        "skills": links.get("skill_names") or [],
        "source": "K12-KGraph",
    }


def grade_from_number(n: int, semester: str) -> tuple[str, str]:
    stage = "小学" if n <= 6 else "初中"
    semester_cn = "上册" if semester == "a" else "下册"
    return stage, f"{CN_NUMBERS.get(n, str(n))}年级{semester_cn}"


def book_meta(prefix: str, subject_hint: str) -> dict[str, str]:
    parts = prefix.split("_")
    subject = SUBJECT_EN_TO_CN.get(parts[0], subject_hint)
    publisher = "人教版-人民教育出版社"

    highschool_match = re.match(r"^(.+)_(bx\d|xzxbx\d)_rjb$", prefix)
    if highschool_match or "highschool" in parts:
        stage = "高中"
        code = highschool_match.group(2) if highschool_match else prefix.split("_rjb_", 1)[-1]
        name_map = {
            "bx1": "必修一",
            "bx2": "必修二",
            "bx3": "必修三",
            "xzxbx1": "选择性必修一",
            "xzxbx2": "选择性必修二",
            "xzxbx3": "选择性必修三",
        }
        grade = "高中"
        title_suffix = name_map.get(code, code.upper())
        title = f"{subject}{title_suffix}"
        return {
            "id": prefix,
            "stage": stage,
            "grade": grade,
            "subject": subject,
            "title": title,
            "publisher": publisher,
        }

    match = re.search(r"_(\d)([ab])_rjb$", prefix)
    if match:
        grade_no = int(match.group(1))
        stage, grade = grade_from_number(grade_no, match.group(2))
        return {
            "id": prefix,
            "stage": stage,
            "grade": grade,
            "subject": subject,
            "title": f"{subject}{grade}",
            "publisher": publisher,
        }

    full_book_match = re.search(r"_(\d)_rjb$", prefix)
    if full_book_match:
        grade_no = int(full_book_match.group(1))
        stage = "小学" if grade_no <= 6 else "初中"
        grade = f"{CN_NUMBERS.get(grade_no, str(grade_no))}年级全一册"
        return {
            "id": prefix,
            "stage": stage,
            "grade": grade,
            "subject": subject,
            "title": f"{subject}{grade}",
            "publisher": publisher,
        }

    return {
        "id": prefix,
        "stage": "未分级",
        "grade": "未分级",
        "subject": subject,
        "title": prefix,
        "publisher": publisher,
    }


def source_ids_for_book(stage: str, subject: str) -> list[str]:
    ids = ["k12_kgraph"]
    if subject == "数学":
        ids.append("cmm_math")
        if stage == "小学":
            ids.append("cmath")
    if stage in {"小学", "初中", "高中"}:
        ids.append("e_eval")
    if stage in {"初中", "高中"}:
        ids.extend(["eduqs", "ceval", "m3ke"])
    if subject == "英语":
        ids.append("race")
    return ids


def lesson_content(book: dict[str, Any], kind: str) -> str:
    points = book["knowledge_points"][:18]
    skills = book["skills"][:12]
    questions = book["questions"][:8]
    lines = [f"# {book['title']} · {kind}", ""]
    lines.append(f"- 学段：{book['stage']}")
    lines.append(f"- 年级：{book['grade']}")
    lines.append(f"- 学科：{book['subject']}")
    lines.append(f"- 出版版本：{book['publisher']}")
    lines.append("")

    if kind == "知识点总览":
        lines.append("## 核心知识点")
        for item in points:
            desc = item.get("definition") or item.get("description") or ""
            lines.append(f"- {item['name']}" + (f"：{desc}" if desc else ""))
    elif kind == "能力与方法":
        lines.append("## 能力/方法")
        for item in skills:
            desc = item.get("description") or item.get("definition") or ""
            lines.append(f"- {item['name']}" + (f"：{desc}" if desc else ""))
        if book.get("experiments"):
            lines.append("")
            lines.append("## 实验/探究")
            for item in book["experiments"][:8]:
                lines.append(f"- {item['name']}")
    else:
        lines.append("## 题库样例")
        for idx, item in enumerate(questions, 1):
            lines.append(f"{idx}. {item.get('stem') or item.get('name')}")
        lines.append("")
        lines.append("完整题目见本课本 JSON 的 `questions` 字段；也可继续从 `question_bank_sources` 里的开放数据集补充。")

    return "\n".join(lines).strip() + "\n"


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_books() -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}

    for subject, url in SUBJECT_FILES.items():
        payload = fetch_json(url)
        for node in payload.get("nodes", []):
            prefix = item_prefix(str(node.get("id", "")))
            if not prefix:
                continue
            book = grouped.setdefault(prefix, {
                **book_meta(prefix, subject),
                "schema_version": "1.0",
                "source_license": KGRAPH_LICENSE,
                "sources": [{"id": "k12_kgraph", "url": url}],
                "knowledge_points": [],
                "skills": [],
                "experiments": [],
                "questions": [],
            })
            props = node.get("properties") or {}
            item = {
                "id": node.get("id"),
                "name": node.get("name"),
                **props,
            }
            label = node.get("label")
            if label == "Concept":
                book["knowledge_points"].append(item)
            elif label == "Skill":
                book["skills"].append(item)
            elif label == "Experiment":
                book["experiments"].append(item)
            elif label == "Exercise":
                book["questions"].append(clean_question(node, prefix))

    for filename in AFTERCLASS_FILES:
        url = f"{HG_BASE}/K12-KGraph/afterclass_exercises/{filename}"
        payload = fetch_json(url)
        prefix = canonical_prefix(payload["book_prefix"])
        subject = payload.get("subject") or SUBJECT_EN_TO_CN.get(prefix.split("_")[0], "")
        book = grouped.setdefault(prefix, {
            **book_meta(prefix, subject),
            "schema_version": "1.0",
            "source_license": KGRAPH_LICENSE,
            "sources": [],
            "knowledge_points": [],
            "skills": [],
            "experiments": [],
            "questions": [],
        })
        book["sources"].append({"id": "k12_kgraph_afterclass", "url": url})
        existing = {q["id"] for q in book["questions"]}
        for raw in payload.get("questions", []):
            q = clean_question(raw, prefix)
            if q["id"] not in existing:
                book["questions"].append(q)
                existing.add(q["id"])

    books = sorted(grouped.values(), key=lambda b: (stage_order(b["stage"]), grade_order(b["grade"]), b["subject"], b["title"]))
    for book in books:
        book["question_bank_sources"] = [
            source for source in PUBLIC_SOURCES if source["id"] in source_ids_for_book(book["stage"], book["subject"])
        ]
        book["summary"] = {
            "knowledge_point_count": len(book["knowledge_points"]),
            "skill_count": len(book["skills"]),
            "experiment_count": len(book["experiments"]),
            "question_count": len(book["questions"]),
        }
    return books


def stage_order(stage: str) -> int:
    return {"小学": 1, "小升初衔接": 2, "初中": 3, "高中": 4}.get(stage, 9)


def grade_order(grade: str) -> int:
    order = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    if grade == "高中":
        return 10
    first = grade[:1]
    base = order.get(first, 99)
    return base * 10 + (0 if "上" in grade else 1)


def build_bridge_book(books: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {book["id"]: book for book in books}
    source_books = [by_id.get("math_6b_rjb"), by_id.get("math_7a_rjb")]
    source_books = [book for book in source_books if book]
    bridge_points = [
        {
            "id": "bridge_math_001",
            "name": "整数、小数、分数到有理数",
            "description": "把小学数的运算经验迁移到负数、有理数、数轴和绝对值。",
            "from": "六年级下册数学",
            "to": "七年级上册数学",
        },
        {
            "id": "bridge_math_002",
            "name": "算术表达式到代数式",
            "description": "从具体数量关系过渡到用字母表示数、列代数式和合并同类项。",
            "from": "小学数量关系",
            "to": "七年级整式",
        },
        {
            "id": "bridge_math_003",
            "name": "等量关系到一元一次方程",
            "description": "把小学方程和应用题中的等量关系，升级为规范建模、解方程与检验。",
            "from": "小学简易方程",
            "to": "七年级一元一次方程",
        },
        {
            "id": "bridge_math_004",
            "name": "图形认识到几何语言",
            "description": "从平面图形面积/周长，过渡到线段、角、相交线、平行线和推理表达。",
            "from": "小学图形与几何",
            "to": "七年级几何初步",
        },
        {
            "id": "bridge_math_005",
            "name": "统计图表到数据分析",
            "description": "从读图和平均数，过渡到数据收集、整理、描述与简单判断。",
            "from": "小学统计",
            "to": "初中数据分析",
        },
    ]

    questions: list[dict[str, Any]] = []
    for book in source_books:
        questions.extend(book.get("questions", [])[:20])

    return {
        "schema_version": "1.0",
        "id": "bridge_primary_to_junior_math",
        "stage": "小升初衔接",
        "grade": "六升七",
        "subject": "数学",
        "title": "小升初数学衔接",
        "publisher": "开放资料整理",
        "source_license": "混合开放来源，见 question_bank_sources",
        "sources": [
            {"id": "k12_kgraph", "url": "https://huggingface.co/datasets/lhpku20010120/K12-KGraph"},
            {"id": "cmm_math", "url": "https://huggingface.co/datasets/ecnu-icalk/cmm-math"},
            {"id": "cmath", "url": "https://huggingface.co/datasets/weitianwen/cmath"},
        ],
        "knowledge_points": bridge_points,
        "skills": [
            {"id": "bridge_skill_001", "name": "从算术思维转向代数思维"},
            {"id": "bridge_skill_002", "name": "用规范步骤表达推理过程"},
            {"id": "bridge_skill_003", "name": "整理错因：概念、计算、审题、建模"},
        ],
        "experiments": [],
        "questions": questions,
        "question_bank_sources": [source for source in PUBLIC_SOURCES if source["id"] in {"k12_kgraph", "cmm_math", "cmath", "e_eval"}],
        "summary": {
            "knowledge_point_count": len(bridge_points),
            "skill_count": 3,
            "experiment_count": 0,
            "question_count": len(questions),
        },
    }


def build_catalog(books: list[dict[str, Any]]) -> dict[str, Any]:
    courses = []
    lessons = []
    questions = []
    course_id = 10000
    lesson_id = 20000
    question_id = 30000

    default_passwords = {"cary": "123456", "lucy": "123456", "1": "1"}
    users = [
        {
            "id": 1,
            "username": "1",
            "full_name": "教师",
            "stage": "全部",
            "grade": "全部",
            "level_label": "教师",
            "email": "",
            "school": "",
            "bio": "默认教师账号，可查看全部课本。",
            "role": "teacher",
        },
        {
            "id": 2,
            "username": "cary",
            "full_name": "Cary",
            "stage": "小学",
            "grade": "六年级",
            "level_label": "小升初衔接",
            "email": "",
            "school": "",
            "bio": "默认学生账号，已开通全部开放 K12 资料。",
            "role": "student",
        },
        {
            "id": 3,
            "username": "lucy",
            "full_name": "Lucy",
            "stage": "初中",
            "grade": "七年级",
            "level_label": "同步学习",
            "email": "",
            "school": "",
            "bio": "默认学生账号，已开通全部开放 K12 资料。",
            "role": "student",
        },
    ]

    for book in books:
        course_id += 1
        course = {
            "id": course_id,
            "stage": book["stage"],
            "subject": book["subject"],
            "title": book["title"],
            "grade": book["grade"],
            "description": (
                f"{book['publisher']}；{book['summary']['knowledge_point_count']} 个知识点，"
                f"{book['summary']['question_count']} 道/条练习，来源见 data/textbooks/{book['id']}.json。"
            ),
            "folder_path": f"data/textbooks/{book['id']}.json",
            "cover_path": None,
        }
        courses.append(course)

        lesson_kinds = ["知识点总览", "能力与方法", "题库练习"]
        question_lesson_id = None
        for order, kind in enumerate(lesson_kinds, 1):
            lesson_id += 1
            if kind == "题库练习":
                question_lesson_id = lesson_id
            lessons.append({
                "id": lesson_id,
                "course_id": course_id,
                "lesson_order": order,
                "title": kind,
                "content_path": f"data/textbooks/{book['id']}.json#{kind}",
                "audio_path": None,
                "folder_path": f"data/textbooks/{book['id']}.json",
                "content": lesson_content(book, kind),
                "source_page": None,
            })

        for raw in book.get("questions", []):
            if not (raw.get("stem") or raw.get("answer")):
                continue
            question_id += 1
            questions.append({
                "id": question_id,
                "lesson_id": question_lesson_id,
                "question_text": raw.get("stem") or "",
                "options": [],
                "answer": raw.get("answer") or "",
                "explanation": raw.get("analysis") or "",
                "question_kind": raw.get("type") or "练习题",
                "source_label": raw.get("source") or "open_k12",
                "source_page": None,
                "source_type": "open_dataset",
            })

    return {
        "source": "open_k12_noncommercial",
        "generated_at": date.today().isoformat(),
        "resource_root_hint": "data/textbooks",
        "default_passwords": default_passwords,
        "users": users,
        "enrollments": [
            {
                "user_id": user_id,
                "course_id": course["id"],
                "purchased_at": f"{date.today().isoformat()}T00:00:00Z",
            }
            for user_id in [2, 3]
            for course in courses
        ],
        "sources": PUBLIC_SOURCES,
        "courses": courses,
        "lessons": lessons,
        "questions": questions,
        "resources": [],
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    safe_recreate_dir(TEXTBOOK_DIR)

    books = build_books()
    books.append(build_bridge_book(books))
    books = sorted(books, key=lambda b: (stage_order(b["stage"]), grade_order(b["grade"]), b["subject"], b["title"]))

    for book in books:
        write_json(TEXTBOOK_DIR / f"{book['id']}.json", book)

    write_json(DATA_DIR / "open_k12_sources.json", PUBLIC_SOURCES)
    write_json(DATA_DIR / "catalog.json", build_catalog(books))

    print(f"Generated {len(books)} textbook JSON files")
    print(f"Generated catalog with {sum(len(b.get('questions', [])) for b in books)} questions")


if __name__ == "__main__":
    main()
