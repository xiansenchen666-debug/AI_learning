import { Pool } from "pg";

type CatalogRow = Record<string, unknown>;

const catalog = JSON.parse(
  await Deno.readTextFile(new URL("./data/catalog.json", import.meta.url)),
);
const schema = await Deno.readTextFile(
  new URL("./schema.postgres.sql", import.meta.url),
);
const databaseUrl = Deno.env.get("DATABASE_URL");
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 1 })
  : new Pool({
    host: Deno.env.get("PGHOST") || "127.0.0.1",
    port: Number(Deno.env.get("PGPORT") || 5432),
    user: Deno.env.get("PGUSER") || "postgres",
    password: Deno.env.get("PGPASSWORD") || "",
    database: Deno.env.get("PGDATABASE") || "ai_learning",
    max: 1,
  });

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function insertBatch(
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  if (!rows.length) return;
  const params = rows.flat();
  const values = rows.map((row, rowIndex) => {
    const offset = rowIndex * row.length;
    return `(${row.map((_, index) => `$${offset + index + 1}`).join(", ")})`;
  });
  await pool.query(
    `INSERT INTO ${table} (${columns.join(", ")})
     VALUES ${values.join(", ")}
     ON CONFLICT DO NOTHING`,
    params,
  );
}

function normalizedUsername(value: unknown, userId: string) {
  return String(value || "").trim().toLowerCase() || `user-${userId}`;
}

try {
  await pool.query(schema);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_schema_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    "ALTER TABLE ai_users ADD COLUMN IF NOT EXISTS access_expires_on DATE",
  );
  await pool.query(
    "ALTER TABLE ai_users ADD COLUMN IF NOT EXISTS teacher_id BIGINT REFERENCES ai_users (id) ON DELETE SET NULL",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_ai_users_teacher ON ai_users (teacher_id)",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_lesson_records (
      id BIGSERIAL PRIMARY KEY,
      teacher_id BIGINT NOT NULL REFERENCES ai_users (id) ON DELETE CASCADE,
      student_id BIGINT NOT NULL REFERENCES ai_users (id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      ai_analysis TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_ai_lesson_records_student ON ai_lesson_records (student_id, created_at DESC)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_ai_lesson_records_teacher ON ai_lesson_records (teacher_id, created_at DESC)",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_growth_analyses (
      student_id BIGINT PRIMARY KEY REFERENCES ai_users (id) ON DELETE CASCADE,
      source_hash CHAR(64) NOT NULL,
      model VARCHAR(200) NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_ai_growth_analyses_updated ON ai_growth_analyses (updated_at DESC)",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_growth_jobs (
      student_id BIGINT PRIMARY KEY REFERENCES ai_users (id) ON DELETE CASCADE,
      requested_revision BIGINT NOT NULL DEFAULT 1 CHECK (requested_revision > 0),
      requested_source_hash TEXT NOT NULL DEFAULT '',
      claim_id UUID,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'failed', 'completed')),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      last_error TEXT NOT NULL DEFAULT '',
      next_attempt_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    "ALTER TABLE ai_growth_jobs ADD COLUMN IF NOT EXISTS requested_revision BIGINT NOT NULL DEFAULT 1",
  );
  await pool.query(
    "ALTER TABLE ai_growth_jobs ADD COLUMN IF NOT EXISTS claim_id UUID",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_ai_growth_jobs_ready ON ai_growth_jobs (status, next_attempt_at, updated_at)",
  );
  await pool.query(`
    INSERT INTO ai_growth_jobs (
      student_id, requested_revision, requested_source_hash, claim_id,
      status, attempt_count, last_error, next_attempt_at, updated_at
    )
    SELECT DISTINCT r.student_id, 1, '', NULL::UUID,
           'pending', 0, '', NULL::TIMESTAMPTZ, NOW()
    FROM ai_lesson_records AS r
    JOIN ai_users AS u ON u.id = r.student_id
    WHERE u.deleted_at IS NULL AND u.role = 'student'
    ON CONFLICT (student_id) DO NOTHING
  `);

  const defaultPasswords: Record<string, string> = catalog.default_passwords ||
    {};
  const deploymentTeacherPassword = String(
    Deno.env.get("DEFAULT_TEACHER_PASSWORD") || "",
  ).trim();
  if (Deno.env.get("DENO_DEPLOY") && !deploymentTeacherPassword) {
    throw new Error(
      "DEFAULT_TEACHER_PASSWORD is required for Deno Deploy migrations.",
    );
  }
  if (deploymentTeacherPassword && deploymentTeacherPassword.length < 12) {
    throw new Error(
      "DEFAULT_TEACHER_PASSWORD must contain at least 12 characters.",
    );
  }
  const users = await Promise.all(
    (catalog.users || []).map(async (user: CatalogRow) => {
      const username = normalizedUsername(
        user.username,
        String(user.id || "seed"),
      );
      const catalogPassword = defaultPasswords[username.toLowerCase()] ||
        (user.role === "teacher" ? "1" : "123456");
      const password = user.role === "teacher" && deploymentTeacherPassword
        ? deploymentTeacherPassword
        : catalogPassword;
      return [
        Number(user.id),
        username,
        await hashPassword(password),
        user.full_name || username,
        user.stage || "",
        user.grade || "",
        user.level_label || "",
        user.email || "",
        user.school || "",
        user.bio || "",
        user.role || "student",
      ];
    }),
  );
  await insertBatch(
    "ai_users",
    [
      "id",
      "username",
      "password_hash",
      "full_name",
      "stage",
      "grade",
      "level_label",
      "email",
      "school",
      "bio",
      "role",
    ],
    users,
  );
  if (deploymentTeacherPassword) {
    const secureTeacherHash = await hashPassword(deploymentTeacherPassword);
    for (
      const user of (catalog.users || []).filter((item: CatalogRow) =>
        item.role === "teacher"
      )
    ) {
      const username = String(user.username || "");
      const legacyPassword = defaultPasswords[username.toLowerCase()] || "1";
      await pool.query(
        `WITH upgraded AS (
           UPDATE ai_users
           SET password_hash = $1, updated_at = NOW()
           WHERE LOWER(username) = LOWER($2)
             AND role IN ('teacher', 'admin')
             AND password_hash = $3
           RETURNING id
         )
         DELETE FROM ai_sessions
         WHERE user_id IN (SELECT id FROM upgraded)`,
        [
          secureTeacherHash,
          username,
          await hashPassword(legacyPassword),
        ],
      );
    }
  }

  await pool.query(
    `WITH promoted_admin AS (
       UPDATE ai_users
       SET role = 'admin', deleted_at = NULL, updated_at = NOW()
       WHERE LOWER(username) = '1'
         AND (role <> 'admin' OR deleted_at IS NOT NULL)
       RETURNING id
     )
     DELETE FROM ai_sessions
     WHERE user_id IN (SELECT id FROM promoted_admin)`,
  );

  await pool.query(
    `WITH applied_migration AS (
       INSERT INTO ai_schema_migrations (migration_key)
       VALUES ('2026-07-15-reset-admin-1-password')
       ON CONFLICT DO NOTHING
       RETURNING migration_key
     ), reset_admin AS (
       UPDATE ai_users
       SET password_hash = $1, role = 'admin', deleted_at = NULL,
           updated_at = NOW()
       WHERE LOWER(username) = '1'
         AND EXISTS (SELECT 1 FROM applied_migration)
       RETURNING id
     )
     DELETE FROM ai_sessions
     WHERE user_id IN (SELECT id FROM reset_admin)`,
    [await hashPassword("1")],
  );

  await insertBatch(
    "ai_course_enrollments",
    ["user_id", "course_id", "purchased_at"],
    (catalog.enrollments || []).map((item: CatalogRow) => [
      Number(item.user_id),
      Number(item.course_id),
      item.purchased_at || new Date().toISOString(),
    ]),
  );
  await insertBatch(
    "ai_progress",
    ["user_id", "lesson_id", "status", "score", "last_answer", "updated_at"],
    (catalog.progress || []).map((item: CatalogRow) => [
      Number(item.user_id),
      Number(item.lesson_id),
      item.status || "not_started",
      Number(item.score || 0),
      item.last_answer || null,
      item.updated_at || new Date().toISOString(),
    ]),
  );
  await insertBatch(
    "ai_question_attempts",
    ["user_id", "question_id", "lesson_id", "answer", "correct", "updated_at"],
    (catalog.question_attempts || []).map((item: CatalogRow) => [
      Number(item.user_id),
      Number(item.question_id),
      Number(item.lesson_id),
      item.answer || "",
      Boolean(item.correct),
      item.updated_at || new Date().toISOString(),
    ]),
  );
  await insertBatch(
    "ai_study_time",
    ["user_id", "lesson_id", "seconds", "updated_at"],
    (catalog.study_time || []).map((item: CatalogRow) => [
      Number(item.user_id),
      Number(item.lesson_id),
      Number(item.seconds || 0),
      item.updated_at || new Date().toISOString(),
    ]),
  );
  await pool.query(`
    SELECT SETVAL(
      PG_GET_SERIAL_SEQUENCE('ai_users', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM ai_users), 1),
      TRUE
    )
  `);
  console.log("PostgreSQL schema and seed data are ready.");
} finally {
  await pool.end();
}
