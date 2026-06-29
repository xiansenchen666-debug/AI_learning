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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_sessions (
  session_id CHAR(36) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_sessions_user (user_id),
  INDEX idx_ai_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_course_enrollments (
  user_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_progress (
  user_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  score DOUBLE NOT NULL DEFAULT 0,
  last_answer TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id),
  INDEX idx_ai_progress_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_question_attempts (
  user_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  answer TEXT NOT NULL,
  correct TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id),
  INDEX idx_ai_attempts_user_lesson (user_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_study_time (
  user_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  seconds BIGINT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
