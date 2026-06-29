import mysql from "npm:mysql2@^3/promise";

type Dict<T = unknown> = Record<string, T>;

type User = {
  id: number;
  username: string;
  full_name: string;
  stage: string;
  grade: string;
  level_label: string;
  email: string;
  school: string;
  bio?: string;
  role: string;
  password_hash?: string;
};

type Course = {
  id: number;
  stage: string;
  subject: string;
  title: string;
  grade: string;
  description: string;
  folder_path: string;
  cover_path?: string | null;
};

type Lesson = {
  id: number;
  course_id: number;
  lesson_order: number;
  title: string;
  content_path: string;
  audio_path?: string | null;
  folder_path: string;
  content: string;
  source_page?: number | null;
};

type Question = {
  id: number;
  lesson_id: number;
  question_text: string;
  options: string[];
  answer: string;
  explanation: string;
  question_kind: string;
  source_label?: string;
  source_page?: number | null;
  source_type?: string;
};

const catalog = JSON.parse(await Deno.readTextFile(new URL("./data/catalog.json", import.meta.url)));
const mysqlUrl = Deno.env.get("DATABASE_URL");
const mysqlDatabase = Deno.env.get("MYSQL_DATABASE") || "ai_learning";
if (!mysqlUrl) {
  const bootstrap = await mysql.createConnection({
    host: Deno.env.get("MYSQL_HOST") || "127.0.0.1",
    port: Number(Deno.env.get("MYSQL_PORT") || 3306),
    user: Deno.env.get("MYSQL_USER") || "root",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS ${mysqlIdentifier(mysqlDatabase)} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrap.end();
}
const mysqlPool = mysqlUrl
  ? mysql.createPool(mysqlUrl)
  : mysql.createPool({
    host: Deno.env.get("MYSQL_HOST") || "127.0.0.1",
    port: Number(Deno.env.get("MYSQL_PORT") || 3306),
    user: Deno.env.get("MYSQL_USER") || "root",
    password: Deno.env.get("MYSQL_PASSWORD") || "",
    database: mysqlDatabase,
    waitForConnections: true,
    connectionLimit: Number(Deno.env.get("MYSQL_CONNECTION_LIMIT") || 10),
    namedPlaceholders: false,
  });

const courses: Course[] = catalog.courses || [];
const lessons: Lesson[] = catalog.lessons || [];
const questions: Question[] = catalog.questions || [];
const resources: Dict[] = catalog.resources || [];
const defaultPasswords: Record<string, string> = catalog.default_passwords || {};

const courseById = new Map(courses.map((item) => [Number(item.id), item]));
const lessonById = new Map(lessons.map((item) => [Number(item.id), item]));
const questionsByLesson = groupBy(questions, (item) => Number(item.lesson_id));
const lessonsByCourse = groupBy(lessons, (item) => Number(item.course_id));

const LOCAL_RESOURCE_ROOT = Deno.env.get("LOCAL_RESOURCE_ROOT") ||
  normalizeLocalPath(new URL("../AI_learning_bendi/resources/", import.meta.url).pathname);
const RESOURCE_BASE_URL = (Deno.env.get("RESOURCE_BASE_URL") || "").replace(/\/+$/, "");

await initMysql();

function mysqlIdentifier(value: string) {
  return `\`${value.replaceAll("`", "``")}\``;
}

function normalizeLocalPath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  return Deno.build.os === "windows" && /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : decoded;
}

function groupBy<T>(items: T[], picker: (item: T) => string | number): Map<string | number, T[]> {
  const result = new Map<string | number, T[]>();
  for (const item of items) {
    const key = picker(item);
    result.set(key, [...(result.get(key) || []), item]);
  }
  return result;
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function redirect(location: string, headers: Headers = new Headers()) {
  headers.set("location", location);
  return new Response("", { status: 302, headers });
}

function parseCookies(headers: Headers): Record<string, string> {
  const raw = headers.get("cookie") || "";
  return Object.fromEntries(
    raw.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, decodeURIComponent(rest.join("=") || "")];
    }).filter(([name]) => name),
  );
}

function setCookie(headers: Headers, name: string, value: string, maxAge: number) {
  headers.append(
    "set-cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

async function dbRows<T = Dict>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await mysqlPool.execute(sql, params);
  return rows as T[];
}

async function dbExec(sql: string, params: any[] = []) {
  const [result] = await mysqlPool.execute(sql, params);
  return result as any;
}

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function initMysql() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(191) NOT NULL UNIQUE,
      password_hash CHAR(64) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      stage VARCHAR(100) NOT NULL DEFAULT '',
      grade VARCHAR(100) NOT NULL DEFAULT '',
      level_label VARCHAR(100) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      school VARCHAR(255) NOT NULL DEFAULT '',
      bio TEXT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'student',
      deleted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      session_id CHAR(36) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ai_sessions_user (user_id),
      INDEX idx_ai_sessions_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_course_enrollments (
      user_id BIGINT NOT NULL,
      course_id BIGINT NOT NULL,
      purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, course_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_progress (
      user_id BIGINT NOT NULL,
      lesson_id BIGINT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'not_started',
      score DOUBLE NOT NULL DEFAULT 0,
      last_answer TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id),
      INDEX idx_ai_progress_user_updated (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_question_attempts (
      user_id BIGINT NOT NULL,
      question_id BIGINT NOT NULL,
      lesson_id BIGINT NOT NULL,
      answer TEXT NOT NULL,
      correct TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, question_id),
      INDEX idx_ai_attempts_user_lesson (user_id, lesson_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_mistakes (
      user_id BIGINT NOT NULL,
      question_id BIGINT NOT NULL,
      question_text TEXT NOT NULL,
      explanation TEXT NOT NULL,
      course_id BIGINT NULL,
      lesson_id BIGINT NULL,
      stage VARCHAR(100) NOT NULL DEFAULT '',
      subject VARCHAR(100) NOT NULL DEFAULT '',
      course_title VARCHAR(255) NOT NULL DEFAULT '',
      lesson_title VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, question_id),
      INDEX idx_ai_mistakes_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS ai_study_time (
      user_id BIGINT NOT NULL,
      lesson_id BIGINT NOT NULL,
      seconds BIGINT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedMysqlFromCatalog();
}

async function seedMysqlFromCatalog() {
  for (const user of catalog.users || []) {
    const username = String(user.username || "").toLowerCase();
    const password = defaultPasswords[username] || (user.role === "teacher" ? "1" : "123456");
    await dbExec(
      `
      INSERT IGNORE INTO ai_users (
        id, username, password_hash, full_name, stage, grade,
        level_label, email, school, bio, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        Number(user.id),
        user.username,
        await hashPassword(password),
        user.full_name || user.username,
        user.stage || "",
        user.grade || "",
        user.level_label || "",
        user.email || "",
        user.school || "",
        user.bio || "",
        user.role || "student",
      ],
    );
  }
  for (const item of catalog.enrollments || []) {
    await dbExec(
      "INSERT IGNORE INTO ai_course_enrollments (user_id, course_id, purchased_at) VALUES (?, ?, ?)",
      [Number(item.user_id), Number(item.course_id), String(item.purchased_at || mysqlNow()).replace("T", " ")],
    );
  }
  for (const item of catalog.progress || []) {
    await dbExec(
      `
      INSERT IGNORE INTO ai_progress (user_id, lesson_id, status, score, last_answer, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        Number(item.user_id),
        Number(item.lesson_id),
        item.status || "not_started",
        Number(item.score || 0),
        item.last_answer || null,
        String(item.updated_at || mysqlNow()).replace("T", " "),
      ],
    );
  }
  for (const item of catalog.question_attempts || []) {
    await dbExec(
      `
      INSERT IGNORE INTO ai_question_attempts (user_id, question_id, lesson_id, answer, correct, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        Number(item.user_id),
        Number(item.question_id),
        Number(item.lesson_id),
        item.answer || "",
        item.correct ? 1 : 0,
        String(item.updated_at || mysqlNow()).replace("T", " "),
      ],
    );
  }
  for (const item of catalog.study_time || []) {
    await dbExec(
      `
      INSERT IGNORE INTO ai_study_time (user_id, lesson_id, seconds, updated_at)
      VALUES (?, ?, ?, ?)
      `,
      [
        Number(item.user_id),
        Number(item.lesson_id),
        Number(item.seconds || 0),
        String(item.updated_at || mysqlNow()).replace("T", " "),
      ],
    );
  }
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/dashboard.html";
  if (!pathname.includes(".") && !pathname.startsWith("/api/")) return `${pathname}.html`;
  return pathname;
}

function contentType(pathname: string) {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".mp3")) return "audio/mpeg";
  if (pathname.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

async function readStatic(pathname: string) {
  const target = new URL(`.${pathname}`, import.meta.url);
  return await Deno.readFile(target);
}

async function loadUserById(userId: number): Promise<User | null> {
  const rows = await dbRows<User>(
    `
    SELECT id, username, password_hash, full_name, stage, grade, level_label,
           email, school, bio, role
    FROM ai_users
    WHERE id = ? AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );
  return rows[0] || null;
}

async function loadUserByUsername(username: string): Promise<User | null> {
  const normalized = username.trim().toLowerCase();
  const rows = await dbRows<User>(
    `
    SELECT id, username, password_hash, full_name, stage, grade, level_label,
           email, school, bio, role
    FROM ai_users
    WHERE LOWER(username) = ? AND deleted_at IS NULL
    LIMIT 1
    `,
    [normalized],
  );
  return rows[0] || null;
}

function userPayload(user: User) {
  const fullName = user.full_name || user.username;
  return {
    id: user.id,
    username: user.username,
    full_name: fullName,
    role: user.role || "student",
    stage: user.stage || "",
    grade: user.grade || "",
    level_label: user.level_label || "",
    email: user.email || "",
    school: user.school || "",
    bio: user.bio || "",
    avatar_text: fullName.slice(0, 2).toUpperCase(),
  };
}

async function currentUser(request: Request): Promise<User | null> {
  const sessionId = parseCookies(request.headers).sessionId;
  if (!sessionId) return null;
  const rows = await dbRows<{ user_id: number }>(
    "SELECT user_id FROM ai_sessions WHERE session_id = ? AND expires_at > NOW() LIMIT 1",
    [sessionId],
  );
  if (!rows[0]) return null;
  return await loadUserById(Number(rows[0].user_id));
}

function isTeacher(user: User | null) {
  return Boolean(user && ["teacher", "admin"].includes(user.role));
}

async function getEnrollments(user: User) {
  if (isTeacher(user)) return courses.map((course) => course.id);
  const rows = await dbRows<{ course_id: number }>(
    "SELECT course_id FROM ai_course_enrollments WHERE user_id = ? ORDER BY course_id",
    [user.id],
  );
  return rows.map((item) => Number(item.course_id));
}

async function listProgress(userId: number) {
  return await dbRows<Dict>(
    `
    SELECT user_id, lesson_id, status, score, last_answer,
           DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
    FROM ai_progress
    WHERE user_id = ?
    ORDER BY updated_at DESC
    `,
    [userId],
  );
}

async function listAttempts(userId: number) {
  return await dbRows<Dict>(
    `
    SELECT user_id, question_id, lesson_id, answer, correct,
           DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
    FROM ai_question_attempts
    WHERE user_id = ?
    ORDER BY updated_at DESC
    `,
    [userId],
  );
}

async function listMistakes(userId: number) {
  return await dbRows<Dict>(
    `
    SELECT question_id AS id, question_id, question_text, explanation,
           course_id, lesson_id, stage, subject, course_title, lesson_title,
           DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS created_at
    FROM ai_mistakes
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [userId],
  );
}

async function listStudyTime(userId: number) {
  return await dbRows<Dict>(
    `
    SELECT user_id, lesson_id, seconds,
           DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
    FROM ai_study_time
    WHERE user_id = ?
    ORDER BY updated_at DESC
    `,
    [userId],
  );
}

function questionPayload(question: Question, courseId?: number) {
  return {
    id: question.id,
    question: question.question_text,
    options: question.options || [],
    answer: question.answer,
    explanation: question.explanation || "",
    kind: question.question_kind || "textbook",
    source_label: question.source_label || "",
    source_page: question.source_page || null,
    source_type: question.source_type || "",
    figure_url: question.source_page && courseId ? `/api/course/${courseId}/page/${question.source_page}/image` : null,
  };
}

function gradeLock(course: Course) {
  return {
    grade: course.grade,
    subject: course.subject,
    label: `${course.grade} ${course.subject}题库`,
    message: `题库已限定在 ${course.stage} / ${course.grade} / ${course.subject} 范围内。`,
  };
}

async function learnerProfile(userId: number, courseId?: number) {
  const attempts = await listAttempts(userId);
  const scopedAttempts = courseId
    ? attempts.filter((item) => lessonById.get(Number(item.lesson_id))?.course_id === courseId)
    : attempts;
  const correctCount = scopedAttempts.filter((item) => Boolean(item.correct)).length;
  const mistakes = await listMistakes(userId);
  const study = await listStudyTime(userId);
  const minutes = Math.round(study.reduce((sum, item) => sum + Number(item.seconds || 0), 0) / 60);
  return {
    attempt_count: scopedAttempts.length,
    correct_count: correctCount,
    accuracy: scopedAttempts.length ? Math.round((correctCount / scopedAttempts.length) * 100) : 0,
    mistake_count: mistakes.length,
    study_minutes: minutes,
    weak_subject: mistakes[0]?.subject || "暂无",
    next_steps: scopedAttempts.length ? ["继续完成本节题库。", "错题先复盘，再做同类题。"] : ["先完成随堂题，形成第一条学习记录。"],
  };
}

async function subjectCatalog(user: User) {
  const enrollments = new Set(await getEnrollments(user));
  const byStageSubject = new Map<string, Dict>();
  for (const course of courses) {
    const key = `${course.stage}||${course.subject}`;
    const subject = byStageSubject.get(key) || {
      subject: course.subject,
      resource_key: `${course.stage}/${course.grade}/${course.subject}`,
      course_count: 0,
      lesson_count: 0,
      question_count: 0,
      courses: [],
      templates: [],
    };
    const courseLessons = lessonsByCourse.get(course.id) || [];
    const questionCount = courseLessons.reduce((sum, lesson) => sum + (questionsByLesson.get(lesson.id) || []).length, 0);
    subject.course_count = Number(subject.course_count) + 1;
    subject.lesson_count = Number(subject.lesson_count) + courseLessons.length;
    subject.question_count = Number(subject.question_count) + questionCount;
    (subject.courses as Dict[]).push({
      id: course.id,
      title: course.title,
      grade: course.grade,
      description: course.description,
      resource_key: course.folder_path,
      lesson_count: courseLessons.length,
      question_count: questionCount,
      purchased: isTeacher(user) || enrollments.has(course.id),
    });
    byStageSubject.set(key, subject);
  }

  const byStage = new Map<string, Dict>();
  for (const course of courses) {
    byStage.set(course.stage, byStage.get(course.stage) || {
      stage: course.stage,
      resource_key: course.stage,
      subjects: [],
    });
  }
  for (const [key, subject] of byStageSubject) {
    const stage = key.split("||")[0];
    (byStage.get(stage)?.subjects as Dict[]).push(subject);
  }

  return {
    source_label: "AI_learning_bendi/catalog.json",
    stages: [...byStage.values()].map((stage) => {
      const subjects = stage.subjects as Dict[];
      return {
        ...stage,
        subject_count: subjects.length,
        course_count: subjects.reduce((sum, item) => sum + Number(item.course_count || 0), 0),
        lesson_count: subjects.reduce((sum, item) => sum + Number(item.lesson_count || 0), 0),
        question_count: subjects.reduce((sum, item) => sum + Number(item.question_count || 0), 0),
      };
    }),
  };
}

async function dashboardPayload(user: User) {
  const enrollments = new Set(await getEnrollments(user));
  const userProgress = await listProgress(user.id);
  const mistakes = await listMistakes(user.id);
  const study = await listStudyTime(user.id);
  const enrolledCourses = courses.filter((course) => isTeacher(user) || enrollments.has(course.id));
  const completedCount = userProgress.filter((item) => item.status === "completed").length;
  const reviewCount = userProgress.filter((item) => item.status === "review_required").length;
  const avgScore = userProgress.length
    ? Math.round(userProgress.reduce((sum, item) => sum + Number(item.score || 0), 0) / userProgress.length)
    : 0;
  const studyMinutes = Math.round(study.reduce((sum, item) => sum + Number(item.seconds || 0), 0) / 60);
  const xp = studyMinutes * 8 + completedCount * 120 + Math.max(avgScore, 0) * Math.max(userProgress.length, 1);
  const stageMap = new Map<string, Dict>();
  for (const course of enrolledCourses) {
    const stage = stageMap.get(course.stage) || { stage: course.stage, courses: [] };
    (stage.courses as Dict[]).push({
      id: course.id,
      subject: course.subject,
      title: course.title,
      grade: course.grade,
      description: course.description,
      lesson_count: (lessonsByCourse.get(course.id) || []).length,
    });
    stageMap.set(course.stage, stage);
  }
  const progressItems = userProgress
    .map((item: any) => {
      const lesson = lessonById.get(Number(item.lesson_id));
      const course = lesson ? courseById.get(lesson.course_id) : null;
      return {
        ...item,
        lesson_id: lesson?.id,
        course_id: course?.id,
        lesson_title: lesson?.title || "",
        course_title: course?.title || "",
        subject: course?.subject || "",
        review_reason: item.status === "review_required" ? "错题或低分回流，今天优先复习。" : "按学习记录安排复习。",
      };
    })
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    .slice(0, 6);

  return {
    user: userPayload(user),
    summary: {
      hero_pill: `${user.stage} / ${user.grade} / ${user.level_label}`,
      hero_highlight: userProgress.length ? `${completedCount} 个知识点` : "新的学习路线",
      hero_suffix: userProgress.length ? "已经掌握" : "等待开启",
      hero_desc: userProgress.length ? `当前账号最近平均得分 ${avgScore} 分。` : "当前账号还没有学习记录，请先从已开通课程开始。",
      study_days: new Set(userProgress.map((item) => String(item.updated_at || "").slice(0, 10))).size,
      study_minutes: studyMinutes,
      xp,
      next_level_gap: 500 - (xp % 500 || 0),
      level_progress: xp ? Math.round(((xp % 500) / 500) * 100) : 0,
      avg_score: avgScore,
      completed_count: completedCount,
      review_count: reviewCount,
      mistake_count: mistakes.length,
      stage_course_count: enrolledCourses.length,
      stage_lesson_count: enrolledCourses.reduce((sum, course) => sum + (lessonsByCourse.get(course.id) || []).length, 0),
    },
    stages: [...stageMap.values()],
    progress: progressItems,
    mistakes,
    resource_paths: resources.filter((item) => enrollments.has(Number(item.course_id))).slice(0, 12),
  };
}

async function coursePayload(user: User, courseId: number) {
  const course = courseById.get(courseId);
  if (!course) return null;
  const enrollments = new Set(await getEnrollments(user));
  if (!isTeacher(user) && !enrollments.has(courseId)) return null;
  const progress = new Map((await listProgress(user.id)).map((item) => [Number(item.lesson_id), item]));
  const attempts = await listAttempts(user.id);
  const attemptsByLesson = groupBy(attempts, (item) => Number(item.lesson_id));
  const mistakesByLesson = groupBy(await listMistakes(user.id), (item) => Number(item.lesson_id));
  const study = new Map((await listStudyTime(user.id)).map((item) => [Number(item.lesson_id), item]));

  return {
    course: {
      ...course,
      resource_key: course.folder_path,
    },
    lessons: (lessonsByCourse.get(courseId) || []).map((lesson) => {
      const lessonQuestions = questionsByLesson.get(lesson.id) || [];
      const lessonAttempts = attemptsByLesson.get(lesson.id) || [];
      const correctCount = lessonAttempts.filter((item) => Boolean(item.correct)).length;
      const itemProgress = progress.get(lesson.id);
      return {
        id: lesson.id,
        title: lesson.title,
        order: lesson.lesson_order,
        resource_key: lesson.folder_path,
        content: lesson.content,
        source_page: lesson.source_page || null,
        figure_url: null,
        audio_url: lesson.audio_path ? `/api/lessons/${lesson.id}/audio` : null,
        status: itemProgress?.status || "not_started",
        score: Number(itemProgress?.score || 0),
        textbook_question_count: lessonQuestions.filter((item) => item.question_kind !== "bank").length,
        bank_question_count: lessonQuestions.filter((item) => item.question_kind === "bank").length,
        attempted_count: lessonAttempts.length,
        correct_count: correctCount,
        study_seconds: Number(study.get(lesson.id)?.seconds || 0),
        mistake_count: (mistakesByLesson.get(lesson.id) || []).length,
        questions: lessonQuestions.map((question) => questionPayload(question, courseId)),
      };
    }),
    resources: resources
      .filter((item) => Number(item.course_id) === courseId)
      .map((item) => ({ ...item, resource_key: item.file_path })),
    grade_lock: gradeLock(course),
    learner_profile: await learnerProfile(user.id, courseId),
  };
}

async function questionBankPayload(user: User, lessonId: number) {
  const lesson = lessonById.get(lessonId);
  if (!lesson) return null;
  const course = courseById.get(lesson.course_id);
  if (!course) return null;
  const enrollments = new Set(await getEnrollments(user));
  if (!isTeacher(user) && !enrollments.has(course.id)) return null;
  return {
    course: {
      id: course.id,
      title: course.title,
      stage: course.stage,
      grade: course.grade,
      subject: course.subject,
    },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      order: lesson.lesson_order,
    },
    questions: (questionsByLesson.get(lessonId) || [])
      .filter((item) => item.question_kind === "bank")
      .map((question) => questionPayload(question, course.id)),
    grade_lock: gradeLock(course),
    learner_profile: await learnerProfile(user.id, course.id),
  };
}

async function mistakePayload(userId: number) {
  return await listMistakes(userId);
}

async function growthPayload(user: User) {
  const progress = await listProgress(user.id);
  const mistakes = await listMistakes(user.id);
  const study = await listStudyTime(user.id);
  const attemptedCount = progress.length;
  const completedCount = progress.filter((item) => item.status === "completed").length;
  const reviewCount = progress.filter((item) => item.status === "review_required").length;
  const avgScore = attemptedCount
    ? Math.round(progress.reduce((sum, item) => sum + Number(item.score || 0), 0) / attemptedCount)
    : 0;
  const studyMinutes = Math.round(study.reduce((sum, item) => sum + Number(item.seconds || 0), 0) / 60);
  const masteryRate = attemptedCount ? Math.round((completedCount / attemptedCount) * 100) : 0;
  const recent = progress.slice(0, 4).map((item) => {
    const lesson = lessonById.get(Number(item.lesson_id));
    const course = lesson ? courseById.get(lesson.course_id) : null;
    return {
      title: `${course?.subject || ""} / ${lesson?.title || ""}`,
      summary: `${course?.title || ""}，最近得分 ${Math.round(Number(item.score || 0))} 分。`,
      time: item.updated_at || "",
    };
  });
  return {
    user: userPayload(user),
    headline: `${user.full_name || user.username} 的成长记录`,
    summary: attemptedCount ? `最近共有 ${attemptedCount} 条学习记录，平均得分 ${avgScore} 分。` : "开始学习课程、提交题目后，系统会生成成长分析。",
    metrics: {
      study_minutes: studyMinutes,
      mastery_rate: masteryRate,
      avg_score: avgScore,
      mistake_count: mistakes.length,
      review_count: reviewCount,
    },
    focus_rules: attemptedCount ? ["保持当前学习节奏。", "先处理错题，再推进新课。"] : ["暂无学习记录。"],
    radar: [
      { label: "知识掌握", value: Math.max(0, masteryRate) },
      { label: "逻辑推理", value: Math.max(0, avgScore) },
      { label: "专注投入", value: Math.min(95, 40 + Math.round(studyMinutes / 3)) },
      { label: "纠错效率", value: Math.max(20, 90 - mistakes.length * 8) },
      { label: "语言感知", value: Math.max(30, avgScore - 2) },
    ],
    recent_actions: recent,
    weak_subject: mistakes[0]?.subject || "暂无",
    strong_subject: "暂无",
  };
}

async function adminPayload() {
  const users = await dbRows<User>(
    `
    SELECT id, username, full_name, stage, grade, level_label, email, school, bio, role
    FROM ai_users
    WHERE deleted_at IS NULL AND role NOT IN ('teacher', 'admin')
    ORDER BY id
    `,
  );
  const students = [];
  for (const item of users) {
    students.push({
      ...userPayload(item),
      course_ids: await getEnrollments(item),
    });
  }
  return {
    students,
    courses: courses.map((course) => ({
      ...course,
      lesson_count: (lessonsByCourse.get(course.id) || []).length,
    })),
  };
}

async function parseBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
}

function now() {
  return new Date().toISOString().slice(0, 19);
}

async function api(request: Request, user: User | null, pathname: string) {
  if (pathname === "/api/health") return json({ ok: true, service: "ai-learning-deno-cloud" });

  if (pathname === "/api/login" && request.method === "POST") {
    const body = await parseBody(request);
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const found = await loadUserByUsername(username);
    if (!found || found.password_hash !== await hashPassword(password)) {
      if ((request.headers.get("content-type") || "").includes("application/json")) {
        return json({ ok: false, message: "账号或密码不正确。" }, { status: 401 });
      }
      return redirect("/login.html?error=1");
    }
    const sessionId = crypto.randomUUID();
    await dbExec("DELETE FROM ai_sessions WHERE expires_at <= NOW()");
    await dbExec(
      "INSERT INTO ai_sessions (session_id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
      [sessionId, found.id],
    );
    const headers = new Headers();
    setCookie(headers, "sessionId", sessionId, 60 * 60 * 24 * 7);
    const target = isTeacher(found) ? "/teacher.html" : "/dashboard.html";
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify({ ok: true, redirect: target }), { headers });
    }
    return redirect(target, headers);
  }

  if (pathname === "/api/logout" && request.method === "POST") {
    const sessionId = parseCookies(request.headers).sessionId;
    if (sessionId) await dbExec("DELETE FROM ai_sessions WHERE session_id = ?", [sessionId]);
    const headers = new Headers();
    setCookie(headers, "sessionId", "", 0);
    return json({ ok: true, redirect: "/login.html" }, { headers });
  }

  if (pathname === "/api/session") {
    if (!user) return json({ ok: true, logged_in: false });
    return json({ ok: true, logged_in: true, user: userPayload(user) });
  }

  if (!user) return json({ ok: false, message: "请先登录。" }, { status: 401 });

  if (pathname === "/api/dashboard") return json({ ok: true, data: await dashboardPayload(user) });
  if (pathname === "/api/subjects") return json({ ok: true, data: await subjectCatalog(user) });
  if (pathname === "/api/mistakes") return json({ ok: true, data: await mistakePayload(user.id) });
  if (pathname === "/api/growth") return json({ ok: true, data: await growthPayload(user) });
  if (pathname === "/api/admin/enrollments" && request.method === "GET" && isTeacher(user)) {
    return json({ ok: true, data: await adminPayload() });
  }
  if (pathname === "/api/admin/enrollments" && request.method === "POST" && isTeacher(user)) {
    const body = await request.json();
    const studentId = Number(body.student_id);
    const courseIds = [...new Set((body.course_ids || []).map(Number).filter(Boolean))];
    await dbExec("DELETE FROM ai_course_enrollments WHERE user_id = ?", [studentId]);
    for (const courseId of courseIds) {
      await dbExec(
        "INSERT INTO ai_course_enrollments (user_id, course_id, purchased_at) VALUES (?, ?, NOW())",
        [studentId, courseId],
      );
    }
    return json({ ok: true });
  }
  if (pathname === "/api/admin/students" && request.method === "POST" && isTeacher(user)) {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const result = await dbExec(
      `
      INSERT INTO ai_users (
        username, password_hash, full_name, stage, grade,
        level_label, email, school, bio, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'student')
      `,
      [
        username,
        await hashPassword(password),
        String(body.full_name || username).trim(),
        String(body.stage || ""),
        String(body.grade || ""),
        "Lv.1",
        String(body.email || ""),
        user.school || "",
        "",
      ],
    );
    const created = await loadUserById(Number(result.insertId));
    if (!created) return json({ ok: false, message: "学生创建失败。" }, { status: 500 });
    return json({ ok: true, data: userPayload(created) });
  }
  const studentMatch = pathname.match(/^\/api\/admin\/students\/(\d+)$/);
  if (studentMatch && isTeacher(user)) {
    const studentId = Number(studentMatch[1]);
    if (request.method === "PUT") {
      const existing = await loadUserById(studentId);
      if (!existing) return json({ ok: false, message: "未找到学生。" }, { status: 404 });
      const body = await request.json();
      const nextPasswordHash = body.password
        ? await hashPassword(String(body.password).trim())
        : existing.password_hash;
      await dbExec(
        `
        UPDATE ai_users
        SET username = ?, password_hash = ?, full_name = ?, stage = ?, grade = ?, email = ?
        WHERE id = ? AND deleted_at IS NULL
        `,
        [
          String(body.username || existing.username).trim(),
          nextPasswordHash,
          String(body.full_name || existing.full_name).trim(),
          String(body.stage || existing.stage),
          String(body.grade || existing.grade),
          String(body.email || existing.email),
          studentId,
        ],
      );
      const updated = await loadUserById(studentId);
      if (!updated) return json({ ok: false, message: "学生资料更新失败。" }, { status: 500 });
      return json({ ok: true, data: userPayload(updated) });
    }
    if (request.method === "DELETE") {
      await dbExec("UPDATE ai_users SET deleted_at = NOW() WHERE id = ?", [studentId]);
      await dbExec("DELETE FROM ai_course_enrollments WHERE user_id = ?", [studentId]);
      await dbExec("DELETE FROM ai_sessions WHERE user_id = ?", [studentId]);
      return json({ ok: true });
    }
  }

  const courseMatch = pathname.match(/^\/api\/course\/(\d+)$/);
  if (courseMatch) {
    const data = await coursePayload(user, Number(courseMatch[1]));
    if (!data) return json({ ok: false, message: "未找到课程或尚未开通。" }, { status: 404 });
    return json({ ok: true, data });
  }

  const bankMatch = pathname.match(/^\/api\/lessons\/(\d+)\/question-bank$/);
  if (bankMatch) {
    const data = await questionBankPayload(user, Number(bankMatch[1]));
    if (!data) return json({ ok: false, message: "未找到题库。" }, { status: 404 });
    return json({ ok: true, data });
  }

  const startMatch = pathname.match(/^\/api\/lessons\/(\d+)\/start$/);
  if (startMatch && request.method === "POST") {
    const lessonId = Number(startMatch[1]);
    const progress = { user_id: user.id, lesson_id: lessonId, status: "in_progress", score: 0, updated_at: now() };
    await dbExec(
      `
      INSERT INTO ai_progress (user_id, lesson_id, status, score, updated_at)
      VALUES (?, ?, 'in_progress', 0, NOW())
      ON DUPLICATE KEY UPDATE
        status = IF(status = 'not_started', 'in_progress', status),
        updated_at = NOW()
      `,
      [user.id, lessonId],
    );
    return json({ ok: true, data: progress });
  }

  const studyMatch = pathname.match(/^\/api\/lessons\/(\d+)\/study-time$/);
  if (studyMatch && request.method === "POST") {
    const lessonId = Number(studyMatch[1]);
    const body = await request.json().catch(() => ({}));
    const deltaSeconds = Math.max(0, Number(body.seconds || 0));
    await dbExec(
      `
      INSERT INTO ai_study_time (user_id, lesson_id, seconds, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE seconds = seconds + VALUES(seconds), updated_at = NOW()
      `,
      [user.id, lessonId, deltaSeconds],
    );
    const rows = await dbRows<{ seconds: number }>(
      "SELECT seconds FROM ai_study_time WHERE user_id = ? AND lesson_id = ?",
      [user.id, lessonId],
    );
    const seconds = Number(rows[0]?.seconds || 0);
    const payload = { user_id: user.id, lesson_id: lessonId, seconds, updated_at: now() };
    return json({ ok: true, data: payload });
  }

  const submitMatch = pathname.match(/^\/api\/questions\/(\d+)\/submit$/);
  if (submitMatch && request.method === "POST") {
    const questionId = Number(submitMatch[1]);
    const question = questions.find((item) => Number(item.id) === questionId);
    if (!question) return json({ ok: false, message: "未找到题目。" }, { status: 404 });
    const body = await request.json();
    const answer = String(body.answer || "");
    const correct = answer === question.answer;
    const lessonId = question.lesson_id;
    await dbExec(
      `
      INSERT INTO ai_question_attempts (user_id, question_id, lesson_id, answer, correct, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE answer = VALUES(answer), correct = VALUES(correct), updated_at = NOW()
      `,
      [user.id, questionId, lessonId, answer, correct ? 1 : 0],
    );
    if (!correct) {
      const lesson = lessonById.get(lessonId);
      const course = lesson ? courseById.get(lesson.course_id) : null;
      await dbExec(
        `
        INSERT INTO ai_mistakes (
          user_id, question_id, question_text, explanation, course_id, lesson_id,
          stage, subject, course_title, lesson_title, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          question_text = VALUES(question_text),
          explanation = VALUES(explanation),
          course_id = VALUES(course_id),
          lesson_id = VALUES(lesson_id),
          stage = VALUES(stage),
          subject = VALUES(subject),
          course_title = VALUES(course_title),
          lesson_title = VALUES(lesson_title),
          created_at = NOW()
        `,
        [
          user.id,
          questionId,
          question.question_text,
          question.explanation,
          course?.id || null,
          lesson?.id || null,
          course?.stage || "",
          course?.subject || "",
          course?.title || "",
          lesson?.title || "",
        ],
      );
    } else {
      await dbExec("DELETE FROM ai_mistakes WHERE user_id = ? AND question_id = ?", [user.id, questionId]);
    }
    const lessonQuestions = (questionsByLesson.get(lessonId) || []).filter((item) => item.question_kind === question.question_kind);
    const attempts = (await listAttempts(user.id)).filter((item) => Number(item.lesson_id) === lessonId);
    const correctCount = attempts.filter((item) => Boolean(item.correct)).length;
    const total = Math.max(lessonQuestions.length, 1);
    const score = Math.round((correctCount / total) * 100);
    const status = score >= 80 ? "completed" : "review_required";
    await dbExec(
      `
      INSERT INTO ai_progress (user_id, lesson_id, status, score, last_answer, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        score = VALUES(score),
        last_answer = VALUES(last_answer),
        updated_at = NOW()
      `,
      [user.id, lessonId, status, score, answer],
    );
    return json({
      ok: true,
      data: {
        correct,
        answer: question.answer,
        explanation: question.explanation,
        lesson_id: lessonId,
        question_kind: question.question_kind,
        attempted_count: attempts.length,
        total_questions: total,
        score,
        status,
      },
    });
  }

  if (pathname.startsWith("/api/resources/")) {
    const key = decodeURIComponent(pathname.replace("/api/resources/", ""));
    if (!key || key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
      return new Response("Not Found", { status: 404 });
    }
    if (RESOURCE_BASE_URL) return redirect(`${RESOURCE_BASE_URL}/${key}`);
    const file = await Deno.readFile(`${LOCAL_RESOURCE_ROOT}/${key}`).catch(() => null);
    if (!file) return new Response("Not Found", { status: 404 });
    return new Response(file, { headers: { "content-type": contentType(key) } });
  }

  if (pathname.match(/^\/api\/lessons\/\d+\/figure$/)) return json({ ok: true, data: { figure_url: null } });
  if (pathname.match(/^\/api\/course\/\d+\/page\/\d+\/image$/)) return new Response("Not Found", { status: 404 });
  if (pathname.match(/^\/api\/lessons\/\d+\/audio$/)) return new Response("Not Found", { status: 404 });

  return json({ ok: false, message: "Not Found" }, { status: 404 });
}

Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, async (request) => {
  const url = new URL(request.url);
  const pathname = normalizePathname(url.pathname);
  const user = await currentUser(request);

  if (pathname.startsWith("/api/")) return await api(request, user, pathname);

  const pages = new Set([
    "/login.html",
    "/dashboard.html",
    "/course.html",
    "/grade.html",
    "/question-bank.html",
    "/mistakes.html",
    "/subjects.html",
    "/growth.html",
    "/teacher.html",
  ]);

  if (pages.has(pathname)) {
    if (pathname !== "/login.html" && !user) return redirect("/login.html");
    if (pathname === "/login.html" && user) return redirect(isTeacher(user) ? "/teacher.html" : "/dashboard.html");
  }

  try {
    const file = await readStatic(pathname);
    return new Response(file, {
      headers: {
        "content-type": contentType(pathname),
        "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000" : "no-store",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
});
