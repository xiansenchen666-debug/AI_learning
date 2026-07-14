CREATE TABLE IF NOT EXISTS ai_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(191) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  stage VARCHAR(100) NOT NULL DEFAULT '',
  grade VARCHAR(100) NOT NULL DEFAULT '',
  level_label VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  school VARCHAR(255) NOT NULL DEFAULT '',
  bio TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'student',
  teacher_id BIGINT REFERENCES ai_users (id) ON DELETE SET NULL,
  access_expires_on DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ai_model_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL DEFAULT '',
  api_key_hint TEXT NOT NULL DEFAULT '',
  updated_by BIGINT REFERENCES ai_users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_growth_analyses (
  student_id BIGINT PRIMARY KEY REFERENCES ai_users (id) ON DELETE CASCADE,
  source_hash CHAR(64) NOT NULL,
  model VARCHAR(200) NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_growth_analyses_updated
  ON ai_growth_analyses (updated_at DESC);

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
);
CREATE INDEX IF NOT EXISTS idx_ai_growth_jobs_ready
  ON ai_growth_jobs (status, next_attempt_at, updated_at);

CREATE TABLE IF NOT EXISTS ai_model_usage_daily (
  usage_date DATE NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'user')),
  scope_id BIGINT NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  prompt_tokens BIGINT NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens BIGINT NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usage_date, scope, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_daily_date
  ON ai_model_usage_daily (usage_date DESC);

CREATE TABLE IF NOT EXISTS ai_model_usage_reservations (
  id UUID PRIMARY KEY,
  usage_date DATE NOT NULL,
  user_id BIGINT NOT NULL,
  reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_reservations_active
  ON ai_model_usage_reservations (usage_date, user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_sessions (
  session_id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_expires ON ai_sessions (expires_at);

CREATE TABLE IF NOT EXISTS ai_course_enrollments (
  user_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS ai_progress (
  user_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_answer TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_progress_user_updated ON ai_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_question_attempts (
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_attempts_user_lesson ON ai_question_attempts (user_id, lesson_id);

CREATE TABLE IF NOT EXISTS ai_mistakes (
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  course_id BIGINT,
  lesson_id BIGINT,
  stage VARCHAR(100) NOT NULL DEFAULT '',
  subject VARCHAR(100) NOT NULL DEFAULT '',
  course_title VARCHAR(255) NOT NULL DEFAULT '',
  lesson_title VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_mistakes_user_created ON ai_mistakes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_study_time (
  user_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  seconds BIGINT NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
);
