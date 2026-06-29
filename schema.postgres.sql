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
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
