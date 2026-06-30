import { Pool, types } from "pg";

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
  access_expires_on?: string | Date | null;
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

const catalog = JSON.parse(
  await Deno.readTextFile(new URL("./data/catalog.json", import.meta.url)),
);
types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

const databaseUrl = Deno.env.get("DATABASE_URL");
const pgPool = databaseUrl
  ? new Pool({
    connectionString: databaseUrl,
    max: Number(Deno.env.get("PGPOOL_MAX") || 10),
  })
  : new Pool({
    host: Deno.env.get("PGHOST") || "127.0.0.1",
    port: Number(Deno.env.get("PGPORT") || 5432),
    user: Deno.env.get("PGUSER") || "postgres",
    password: Deno.env.get("PGPASSWORD") || "",
    database: Deno.env.get("PGDATABASE") || "ai_learning",
    max: Number(Deno.env.get("PGPOOL_MAX") || 10),
  });

const courses: Course[] = catalog.courses || [];
const lessons: Lesson[] = catalog.lessons || [];
const questions: Question[] = catalog.questions || [];
const resources: Dict[] = catalog.resources || [];
const courseById = new Map(courses.map((item) => [Number(item.id), item]));
const lessonById = new Map(lessons.map((item) => [Number(item.id), item]));
const questionsByLesson = groupBy(questions, (item) => Number(item.lesson_id));
const lessonsByCourse = groupBy(lessons, (item) => Number(item.course_id));

const LOCAL_RESOURCE_ROOT = Deno.env.get("LOCAL_RESOURCE_ROOT") ||
  normalizeLocalPath(
    new URL("../AI_learning_bendi/resources/", import.meta.url).pathname,
  );
const RESOURCE_BASE_URL = (Deno.env.get("RESOURCE_BASE_URL") || "").replace(
  /\/+$/,
  "",
);

function normalizeLocalPath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  return Deno.build.os === "windows" && /^\/[A-Za-z]:\//.test(decoded)
    ? decoded.slice(1)
    : decoded;
}

function groupBy<T>(
  items: T[],
  picker: (item: T) => string | number,
): Map<string | number, T[]> {
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

function permanentRedirect(location: string) {
  return new Response("", {
    status: 308,
    headers: { location },
  });
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

function setCookie(
  headers: Headers,
  name: string,
  value: string,
  maxAge: number,
) {
  headers.append(
    "set-cookie",
    `${name}=${
      encodeURIComponent(value)
    }; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

async function dbRows<T = Dict>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pgPool.query<T>(postgresParams(sql), params);
  return result.rows;
}

async function dbExec<T = Dict>(sql: string, params: unknown[] = []) {
  return await pgPool.query<T>(postgresParams(sql), params);
}

function postgresParams(sql: string) {
  let index = 0;
  return sql.replaceAll("?", () => `$${++index}`);
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function chinaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function accessDateString(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeAccessDate(value: unknown) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function accessExpiryFromDuration(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 36_500) {
    throw new Error("可使用天数必须是 1 到 36500 之间的整数。");
  }
  const todayTime = Date.parse(`${chinaToday()}T00:00:00Z`);
  return new Date(todayTime + (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function accessRemainingDays(user: User) {
  const expiresOn = accessDateString(user.access_expires_on);
  if (!expiresOn) return null;
  const todayTime = Date.parse(`${chinaToday()}T00:00:00Z`);
  const expiryTime = Date.parse(`${expiresOn}T00:00:00Z`);
  return Math.max(0, Math.round((expiryTime - todayTime) / 86_400_000) + 1);
}

function isAccessExpired(user: User) {
  const expiresOn = accessDateString(user.access_expires_on);
  return Boolean(expiresOn && expiresOn < chinaToday());
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/dashboard.html";
  if (!pathname.includes(".") && !pathname.startsWith("/api/")) {
    return `${pathname}.html`;
  }
  return pathname;
}

function contentType(pathname: string) {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".mp3")) return "audio/mpeg";
  if (pathname.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

function staticCacheControl(pathname: string) {
  if (pathname.startsWith("/assets/")) {
    return "public, max-age=300, stale-while-revalidate=86400";
  }
  if (pathname.endsWith(".html")) {
    return "public, max-age=60, stale-while-revalidate=300";
  }
  return "public, max-age=300, stale-while-revalidate=86400";
}

async function readStatic(pathname: string) {
  const target = new URL(`.${pathname}`, import.meta.url);
  return await Deno.readFile(target);
}

async function loadUserById(userId: number): Promise<User | null> {
  const rows = await dbRows<User>(
    `
    SELECT id, username, password_hash, full_name, stage, grade, level_label,
           email, school, bio, role, access_expires_on
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
           email, school, bio, role, access_expires_on
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
    access_expires_on: accessDateString(user.access_expires_on),
    access_remaining_days: accessRemainingDays(user),
    avatar_text: fullName.slice(0, 2).toUpperCase(),
  };
}

async function currentUser(request: Request): Promise<User | null> {
  const sessionId = parseCookies(request.headers).sessionId;
  if (!sessionId) return null;
  const rows = await dbRows<User>(
    `
    SELECT u.id, u.username, u.password_hash, u.full_name, u.stage, u.grade,
           u.level_label, u.email, u.school, u.bio, u.role,
           u.access_expires_on
    FROM ai_sessions AS s
    JOIN ai_users AS u ON u.id = s.user_id
    WHERE s.session_id = ? AND s.expires_at > NOW() AND u.deleted_at IS NULL
    LIMIT 1
    `,
    [sessionId],
  );
  const user = rows[0] || null;
  if (user && !isTeacher(user) && isAccessExpired(user)) {
    await dbExec("DELETE FROM ai_sessions WHERE session_id = ?", [sessionId]);
    return null;
  }
  return user;
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
           TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
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
           TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
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
           TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
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
           TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
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
    figure_url: question.source_page && courseId
      ? `/api/course/${courseId}/page/${question.source_page}/image`
      : null,
  };
}

function gradeLock(course: Course) {
  return {
    grade: course.grade,
    subject: course.subject,
    label: `${course.grade} ${course.subject}题库`,
    message:
      `题库已限定在 ${course.stage} / ${course.grade} / ${course.subject} 范围内。`,
  };
}

async function learnerProfile(userId: number, courseId?: number) {
  const attempts = await listAttempts(userId);
  const scopedAttempts = courseId
    ? attempts.filter((item) =>
      lessonById.get(Number(item.lesson_id))?.course_id === courseId
    )
    : attempts;
  const correctCount =
    scopedAttempts.filter((item) => Boolean(item.correct)).length;
  const mistakes = await listMistakes(userId);
  const study = await listStudyTime(userId);
  const minutes = Math.round(
    study.reduce((sum, item) => sum + Number(item.seconds || 0), 0) / 60,
  );
  return {
    attempt_count: scopedAttempts.length,
    correct_count: correctCount,
    accuracy: scopedAttempts.length
      ? Math.round((correctCount / scopedAttempts.length) * 100)
      : 0,
    mistake_count: mistakes.length,
    study_minutes: minutes,
    weak_subject: mistakes[0]?.subject || "暂无",
    next_steps: scopedAttempts.length
      ? ["继续完成本节题库。", "错题先复盘，再做同类题。"]
      : ["先完成随堂题，形成第一条学习记录。"],
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
    const questionCount = courseLessons.reduce(
      (sum, lesson) => sum + (questionsByLesson.get(lesson.id) || []).length,
      0,
    );
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
    byStage.set(
      course.stage,
      byStage.get(course.stage) || {
        stage: course.stage,
        resource_key: course.stage,
        subjects: [],
      },
    );
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
        course_count: subjects.reduce(
          (sum, item) => sum + Number(item.course_count || 0),
          0,
        ),
        lesson_count: subjects.reduce(
          (sum, item) => sum + Number(item.lesson_count || 0),
          0,
        ),
        question_count: subjects.reduce(
          (sum, item) => sum + Number(item.question_count || 0),
          0,
        ),
      };
    }),
  };
}

async function loadDashboardData(userId: number) {
  const rows = await dbRows<{
    enrollments: number[];
    progress: Dict[];
    mistakes: Dict[];
    study_seconds: number;
  }>(
    `
    SELECT
      COALESCE((
        SELECT JSON_AGG(e.course_id ORDER BY e.course_id)
        FROM ai_course_enrollments AS e
        WHERE e.user_id = ?
      ), '[]'::json) AS enrollments,
      COALESCE((
        SELECT JSON_AGG(p ORDER BY p.updated_at DESC)
        FROM (
          SELECT user_id, lesson_id, status, score, last_answer,
                 TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
          FROM ai_progress
          WHERE user_id = ?
        ) AS p
      ), '[]'::json) AS progress,
      COALESCE((
        SELECT JSON_AGG(m ORDER BY m.created_at DESC)
        FROM (
          SELECT question_id AS id, question_id, question_text, explanation,
                 course_id, lesson_id, stage, subject, course_title, lesson_title,
                 TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
          FROM ai_mistakes
          WHERE user_id = ?
        ) AS m
      ), '[]'::json) AS mistakes,
      COALESCE((
        SELECT SUM(seconds)
        FROM ai_study_time
        WHERE user_id = ?
      ), 0)::bigint AS study_seconds
    `,
    [userId, userId, userId, userId],
  );
  return rows[0] ||
    { enrollments: [], progress: [], mistakes: [], study_seconds: 0 };
}

async function dashboardPayload(user: User) {
  const dashboard = await loadDashboardData(user.id);
  const enrollments = new Set(
    isTeacher(user)
      ? courses.map((course) => course.id)
      : dashboard.enrollments.map(Number),
  );
  const userProgress = dashboard.progress;
  const mistakes = dashboard.mistakes;
  const enrolledCourses = courses.filter((course) =>
    isTeacher(user) || enrollments.has(course.id)
  );
  const completedCount =
    userProgress.filter((item) => item.status === "completed").length;
  const reviewCount =
    userProgress.filter((item) => item.status === "review_required").length;
  const avgScore = userProgress.length
    ? Math.round(
      userProgress.reduce((sum, item) => sum + Number(item.score || 0), 0) /
        userProgress.length,
    )
    : 0;
  const studyMinutes = Math.round(Number(dashboard.study_seconds || 0) / 60);
  const xp = studyMinutes * 8 + completedCount * 120 +
    Math.max(avgScore, 0) * Math.max(userProgress.length, 1);
  const stageMap = new Map<string, Dict>();
  for (const course of enrolledCourses) {
    const stage = stageMap.get(course.stage) ||
      { stage: course.stage, courses: [] };
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
    .map((item: Dict) => {
      const lesson = lessonById.get(Number(item.lesson_id));
      const course = lesson ? courseById.get(lesson.course_id) : null;
      return {
        ...item,
        updated_at: String(item.updated_at || ""),
        lesson_id: lesson?.id,
        course_id: course?.id,
        lesson_title: lesson?.title || "",
        course_title: course?.title || "",
        subject: course?.subject || "",
        review_reason: item.status === "review_required"
          ? "错题或低分回流，今天优先复习。"
          : "按学习记录安排复习。",
      };
    })
    .sort((a, b) =>
      String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
    )
    .slice(0, 6);

  return {
    user: userPayload(user),
    summary: {
      hero_pill: `${user.stage} / ${user.grade} / ${user.level_label}`,
      hero_highlight: userProgress.length
        ? `${completedCount} 个知识点`
        : "新的学习路线",
      hero_suffix: userProgress.length ? "已经掌握" : "等待开启",
      hero_desc: userProgress.length
        ? `当前账号最近平均得分 ${avgScore} 分。`
        : "当前账号还没有学习记录，请先从已开通课程开始。",
      study_days: new Set(
        userProgress.map((item) => String(item.updated_at || "").slice(0, 10)),
      ).size,
      study_minutes: studyMinutes,
      xp,
      next_level_gap: 500 - (xp % 500 || 0),
      level_progress: xp ? Math.round(((xp % 500) / 500) * 100) : 0,
      avg_score: avgScore,
      completed_count: completedCount,
      review_count: reviewCount,
      mistake_count: mistakes.length,
      stage_course_count: enrolledCourses.length,
      stage_lesson_count: enrolledCourses.reduce(
        (sum, course) => sum + (lessonsByCourse.get(course.id) || []).length,
        0,
      ),
    },
    stages: [...stageMap.values()],
    progress: progressItems,
    mistakes,
    resource_paths: resources.filter((item) =>
      enrollments.has(Number(item.course_id))
    ).slice(0, 12),
  };
}

async function coursePayload(user: User, courseId: number) {
  const course = courseById.get(courseId);
  if (!course) return null;
  const enrollments = new Set(await getEnrollments(user));
  if (!isTeacher(user) && !enrollments.has(courseId)) return null;
  const progress = new Map(
    (await listProgress(user.id)).map((item) => [Number(item.lesson_id), item]),
  );
  const attempts = await listAttempts(user.id);
  const attemptsByLesson = groupBy(attempts, (item) => Number(item.lesson_id));
  const mistakesByLesson = groupBy(
    await listMistakes(user.id),
    (item) => Number(item.lesson_id),
  );
  const study = new Map(
    (await listStudyTime(user.id)).map((
      item,
    ) => [Number(item.lesson_id), item]),
  );

  return {
    course: {
      ...course,
      resource_key: course.folder_path,
    },
    lessons: (lessonsByCourse.get(courseId) || []).map((lesson) => {
      const lessonQuestions = questionsByLesson.get(lesson.id) || [];
      const lessonAttempts = attemptsByLesson.get(lesson.id) || [];
      const correctCount = lessonAttempts.filter((item) =>
        Boolean(item.correct)
      ).length;
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
        textbook_question_count:
          lessonQuestions.filter((item) => item.question_kind !== "bank")
            .length,
        bank_question_count:
          lessonQuestions.filter((item) => item.question_kind === "bank")
            .length,
        attempted_count: lessonAttempts.length,
        correct_count: correctCount,
        study_seconds: Number(study.get(lesson.id)?.seconds || 0),
        mistake_count: (mistakesByLesson.get(lesson.id) || []).length,
        questions: lessonQuestions.map((question) =>
          questionPayload(question, courseId)
        ),
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
  const lessonQuestions = questionsByLesson.get(lessonId) || [];
  const bankQuestions = lessonQuestions.filter((item) =>
    item.question_kind === "bank"
  );
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
    questions: (bankQuestions.length ? bankQuestions : lessonQuestions).map((
      question,
    ) => questionPayload(question, course.id)),
    grade_lock: gradeLock(course),
    learner_profile: await learnerProfile(user.id, course.id),
  };
}

async function mistakePayload(userId: number) {
  return await listMistakes(userId);
}

async function growthPayload(user: User) {
  const snapshot = await loadDashboardData(user.id);
  const progress = snapshot.progress;
  const mistakes = snapshot.mistakes;
  const attemptedCount = progress.length;
  const completedCount =
    progress.filter((item) => item.status === "completed").length;
  const reviewCount =
    progress.filter((item) => item.status === "review_required").length;
  const avgScore = attemptedCount
    ? Math.round(
      progress.reduce((sum, item) => sum + Number(item.score || 0), 0) /
        attemptedCount,
    )
    : 0;
  const studyMinutes = Math.round(Number(snapshot.study_seconds || 0) / 60);
  const masteryRate = attemptedCount
    ? Math.round((completedCount / attemptedCount) * 100)
    : 0;
  const recent = progress.slice(0, 4).map((item) => {
    const lesson = lessonById.get(Number(item.lesson_id));
    const course = lesson ? courseById.get(lesson.course_id) : null;
    return {
      title: `${course?.subject || ""} / ${lesson?.title || ""}`,
      summary: `${course?.title || ""}，最近得分 ${
        Math.round(Number(item.score || 0))
      } 分。`,
      time: item.updated_at || "",
    };
  });
  return {
    user: userPayload(user),
    headline: `${user.full_name || user.username} 的成长记录`,
    summary: attemptedCount
      ? `最近共有 ${attemptedCount} 条学习记录，平均得分 ${avgScore} 分。`
      : "开始学习课程、提交题目后，系统会生成成长分析。",
    metrics: {
      study_minutes: studyMinutes,
      mastery_rate: masteryRate,
      avg_score: avgScore,
      mistake_count: mistakes.length,
      review_count: reviewCount,
    },
    focus_rules: attemptedCount
      ? ["保持当前学习节奏。", "先处理错题，再推进新课。"]
      : ["暂无学习记录。"],
    radar: [
      { label: "知识掌握", value: Math.max(0, masteryRate) },
      { label: "逻辑推理", value: Math.max(0, avgScore) },
      {
        label: "专注投入",
        value: Math.min(95, 40 + Math.round(studyMinutes / 3)),
      },
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
           , access_expires_on
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
  return Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, String(value)]),
  );
}

function now() {
  return new Date().toISOString().slice(0, 19);
}

async function api(request: Request, user: User | null, pathname: string) {
  if (pathname === "/api/health") {
    return json({ ok: true, service: "ai-learning-deno-cloud" });
  }

  if (pathname === "/api/login" && request.method === "POST") {
    const body = await parseBody(request);
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const found = await loadUserByUsername(username);
    if (!found || found.password_hash !== await hashPassword(password)) {
      if (
        (request.headers.get("content-type") || "").includes("application/json")
      ) {
        return json({ ok: false, message: "账号或密码不正确。" }, {
          status: 401,
        });
      }
      return redirect("/login?error=1");
    }
    if (!isTeacher(found) && isAccessExpired(found)) {
      if (
        (request.headers.get("content-type") || "").includes("application/json")
      ) {
        return json({
          ok: false,
          message: "账号使用期限已结束，请联系老师续期。",
        }, { status: 403 });
      }
      return redirect("/login?expired=1");
    }
    const sessionId = crypto.randomUUID();
    await dbExec("DELETE FROM ai_sessions WHERE expires_at <= NOW()");
    await dbExec(
      "INSERT INTO ai_sessions (session_id, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL '7 days')",
      [sessionId, found.id],
    );
    const headers = new Headers();
    setCookie(headers, "sessionId", sessionId, 60 * 60 * 24 * 7);
    const target = isTeacher(found) ? "/teacher" : "/dashboard";
    if (
      (request.headers.get("content-type") || "").includes("application/json")
    ) {
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(
        JSON.stringify({
          ok: true,
          redirect: target,
          user: userPayload(found),
        }),
        { headers },
      );
    }
    return redirect(target, headers);
  }

  if (pathname === "/api/logout" && request.method === "POST") {
    const sessionId = parseCookies(request.headers).sessionId;
    if (sessionId) {
      await dbExec("DELETE FROM ai_sessions WHERE session_id = ?", [sessionId]);
    }
    const headers = new Headers();
    setCookie(headers, "sessionId", "", 0);
    return json({ ok: true, redirect: "/login" }, { headers });
  }

  if (pathname === "/api/session") {
    if (!user) return json({ ok: true, logged_in: false });
    return json({ ok: true, logged_in: true, user: userPayload(user) });
  }

  if (!user) return json({ ok: false, message: "请先登录。" }, { status: 401 });

  if (pathname === "/api/dashboard") {
    return json({ ok: true, data: await dashboardPayload(user) });
  }
  if (pathname === "/api/subjects") {
    return json({ ok: true, data: await subjectCatalog(user) });
  }
  if (pathname === "/api/mistakes") {
    return json({ ok: true, data: await mistakePayload(user.id) });
  }
  if (pathname === "/api/growth") {
    return json({ ok: true, data: await growthPayload(user) });
  }
  if (
    pathname === "/api/admin/enrollments" && request.method === "GET" &&
    isTeacher(user)
  ) {
    return json({ ok: true, data: await adminPayload() });
  }
  if (
    pathname === "/api/admin/enrollments" && request.method === "POST" &&
    isTeacher(user)
  ) {
    const body = await request.json();
    const studentId = Number(body.student_id);
    const validCourseIds = new Set(courses.map((course) => Number(course.id)));
    const courseIds = [
      ...new Set(
        (body.course_ids || []).map(Number).filter((courseId: number) =>
          validCourseIds.has(courseId)
        ),
      ),
    ];
    if (!studentId) {
      return json({ ok: false, message: "学生不存在。" }, { status: 400 });
    }

    const result = await dbRows<{
      selected_count: number;
      inserted_count: number;
      removed_count: number;
    }>(
      `
      WITH selected AS (
        SELECT DISTINCT UNNEST(?::bigint[]) AS course_id
      ),
      removed AS (
        DELETE FROM ai_course_enrollments AS e
        WHERE e.user_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM selected AS s WHERE s.course_id = e.course_id
          )
        RETURNING e.course_id
      ),
      inserted AS (
        INSERT INTO ai_course_enrollments (user_id, course_id, purchased_at)
        SELECT ?, selected.course_id, NOW()
        FROM selected
        ON CONFLICT DO NOTHING
        RETURNING course_id
      )
      SELECT
        (SELECT COUNT(*) FROM selected)::int AS selected_count,
        (SELECT COUNT(*) FROM inserted)::int AS inserted_count,
        (SELECT COUNT(*) FROM removed)::int AS removed_count
      `,
      [courseIds, studentId, studentId],
    );
    return json({
      ok: true,
      data: result[0] || { selected_count: courseIds.length },
    });
  }
  if (
    pathname === "/api/admin/students" && request.method === "POST" &&
    isTeacher(user)
  ) {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const result = await dbExec<{ id: number }>(
      `
      INSERT INTO ai_users (
        username, password_hash, full_name, stage, grade,
        level_label, email, school, bio, role, access_expires_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', ?)
      RETURNING id
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
        body.access_duration_days !== undefined
          ? accessExpiryFromDuration(body.access_duration_days)
          : normalizeAccessDate(body.access_expires_on),
      ],
    );
    const created = await loadUserById(Number(result.rows[0]?.id));
    if (!created) {
      return json({ ok: false, message: "学生创建失败。" }, { status: 500 });
    }
    return json({ ok: true, data: userPayload(created) });
  }
  const studentMatch = pathname.match(/^\/api\/admin\/students\/(\d+)$/);
  if (studentMatch && isTeacher(user)) {
    const studentId = Number(studentMatch[1]);
    if (request.method === "PUT") {
      const existing = await loadUserById(studentId);
      if (!existing) {
        return json({ ok: false, message: "未找到学生。" }, { status: 404 });
      }
      const body = await request.json();
      const nextPasswordHash = body.password
        ? await hashPassword(String(body.password).trim())
        : existing.password_hash;
      await dbExec(
        `
        UPDATE ai_users
        SET username = ?, password_hash = ?, full_name = ?, stage = ?, grade = ?,
            email = ?, access_expires_on = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
        `,
        [
          String(body.username || existing.username).trim(),
          nextPasswordHash,
          String(body.full_name || existing.full_name).trim(),
          String(body.stage || existing.stage),
          String(body.grade || existing.grade),
          String(body.email || existing.email),
          body.access_duration_days !== undefined
            ? accessExpiryFromDuration(body.access_duration_days)
            : normalizeAccessDate(body.access_expires_on),
          studentId,
        ],
      );
      const updated = await loadUserById(studentId);
      if (!updated) {
        return json({ ok: false, message: "学生资料更新失败。" }, {
          status: 500,
        });
      }
      return json({ ok: true, data: userPayload(updated) });
    }
    if (request.method === "DELETE") {
      await dbExec("UPDATE ai_users SET deleted_at = NOW() WHERE id = ?", [
        studentId,
      ]);
      await dbExec("DELETE FROM ai_course_enrollments WHERE user_id = ?", [
        studentId,
      ]);
      await dbExec("DELETE FROM ai_sessions WHERE user_id = ?", [studentId]);
      return json({ ok: true });
    }
  }

  const courseMatch = pathname.match(/^\/api\/course\/(\d+)$/);
  if (courseMatch) {
    const data = await coursePayload(user, Number(courseMatch[1]));
    if (!data) {
      return json({ ok: false, message: "未找到课程或尚未开通。" }, {
        status: 404,
      });
    }
    return json({ ok: true, data });
  }

  const bankMatch = pathname.match(/^\/api\/lessons\/(\d+)\/question-bank$/);
  if (bankMatch) {
    const data = await questionBankPayload(user, Number(bankMatch[1]));
    if (!data) {
      return json({ ok: false, message: "未找到题库。" }, { status: 404 });
    }
    return json({ ok: true, data });
  }

  const startMatch = pathname.match(/^\/api\/lessons\/(\d+)\/start$/);
  if (startMatch && request.method === "POST") {
    const lessonId = Number(startMatch[1]);
    const result = await dbExec<Dict>(
      `
      INSERT INTO ai_progress (user_id, lesson_id, status, score, updated_at)
      VALUES (?, ?, 'in_progress', 0, NOW())
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        status = CASE
          WHEN ai_progress.status = 'not_started' THEN 'in_progress'
          ELSE ai_progress.status
        END,
        updated_at = NOW()
      RETURNING user_id, lesson_id, status, score,
                TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
      `,
      [user.id, lessonId],
    );
    return json({ ok: true, data: result.rows[0] });
  }

  const studyMatch = pathname.match(/^\/api\/lessons\/(\d+)\/study-time$/);
  if (studyMatch && request.method === "POST") {
    const lessonId = Number(studyMatch[1]);
    const body = await request.json().catch(() => ({}));
    const deltaSeconds = Math.max(0, Number(body.seconds || 0));
    const result = await dbExec<{ seconds: number; updated_at: string }>(
      `
      INSERT INTO ai_study_time (user_id, lesson_id, seconds, updated_at)
      VALUES (?, ?, ?, NOW())
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        seconds = ai_study_time.seconds + EXCLUDED.seconds,
        updated_at = NOW()
      RETURNING seconds, TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
      `,
      [user.id, lessonId, deltaSeconds],
    );
    const payload = {
      user_id: user.id,
      lesson_id: lessonId,
      seconds: Number(result.rows[0]?.seconds || 0),
      updated_at: result.rows[0]?.updated_at || now(),
    };
    return json({ ok: true, data: payload });
  }

  const submitMatch = pathname.match(/^\/api\/questions\/(\d+)\/submit$/);
  if (submitMatch && request.method === "POST") {
    const questionId = Number(submitMatch[1]);
    const question = questions.find((item) => Number(item.id) === questionId);
    if (!question) {
      return json({ ok: false, message: "未找到题目。" }, { status: 404 });
    }
    const body = await request.json();
    const answer = String(body.answer || "");
    const correct = answer === question.answer;
    const lessonId = question.lesson_id;
    await dbExec(
      `
      INSERT INTO ai_question_attempts (user_id, question_id, lesson_id, answer, correct, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        answer = EXCLUDED.answer,
        correct = EXCLUDED.correct,
        updated_at = NOW()
      `,
      [user.id, questionId, lessonId, answer, correct],
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
        ON CONFLICT (user_id, question_id) DO UPDATE SET
          question_text = EXCLUDED.question_text,
          explanation = EXCLUDED.explanation,
          course_id = EXCLUDED.course_id,
          lesson_id = EXCLUDED.lesson_id,
          stage = EXCLUDED.stage,
          subject = EXCLUDED.subject,
          course_title = EXCLUDED.course_title,
          lesson_title = EXCLUDED.lesson_title,
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
      await dbExec(
        "DELETE FROM ai_mistakes WHERE user_id = ? AND question_id = ?",
        [user.id, questionId],
      );
    }
    const lessonQuestions = (questionsByLesson.get(lessonId) || []).filter((
      item,
    ) => item.question_kind === question.question_kind);
    const attempts = (await listAttempts(user.id)).filter((item) =>
      Number(item.lesson_id) === lessonId
    );
    const correctCount = attempts.filter((item) =>
      Boolean(item.correct)
    ).length;
    const total = Math.max(lessonQuestions.length, 1);
    const score = Math.round((correctCount / total) * 100);
    const status = score >= 80 ? "completed" : "review_required";
    await dbExec(
      `
      INSERT INTO ai_progress (user_id, lesson_id, status, score, last_answer, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        status = EXCLUDED.status,
        score = EXCLUDED.score,
        last_answer = EXCLUDED.last_answer,
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
    if (
      !key || key.includes("..") || key.startsWith("/") || key.startsWith("\\")
    ) {
      return new Response("Not Found", { status: 404 });
    }
    if (RESOURCE_BASE_URL) return redirect(`${RESOURCE_BASE_URL}/${key}`);
    const file = await Deno.readFile(`${LOCAL_RESOURCE_ROOT}/${key}`).catch(
      () => null,
    );
    if (!file) return new Response("Not Found", { status: 404 });
    return new Response(file, {
      headers: { "content-type": contentType(key) },
    });
  }

  if (pathname.match(/^\/api\/lessons\/\d+\/figure$/)) {
    return json({ ok: true, data: { figure_url: null } });
  }
  if (pathname.match(/^\/api\/course\/\d+\/page\/\d+\/image$/)) {
    return new Response("Not Found", { status: 404 });
  }
  if (pathname.match(/^\/api\/lessons\/\d+\/audio$/)) {
    return new Response("Not Found", { status: 404 });
  }

  return json({ ok: false, message: "Not Found" }, { status: 404 });
}

Deno.serve({ port: Number(Deno.env.get("PORT") || 8000) }, async (request) => {
  const url = new URL(request.url);
  if (url.pathname.endsWith(".html")) {
    const cleanPathname = url.pathname.slice(0, -5) || "/";
    return permanentRedirect(`${cleanPathname}${url.search}`);
  }
  const pathname = normalizePathname(url.pathname);
  if (pathname.startsWith("/api/")) {
    return await api(request, await currentUser(request), pathname);
  }

  try {
    const file = await readStatic(pathname);
    return new Response(file, {
      headers: {
        "content-type": contentType(pathname),
        "cache-control": staticCacheControl(pathname),
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
});
