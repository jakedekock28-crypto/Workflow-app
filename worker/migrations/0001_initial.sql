PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX magic_links_user_expiry ON magic_links(user_id, expires_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_user_expiry ON sessions(user_id, expires_at);

-- The reserved __system__ scope stores only aggregate anti-abuse counters;
-- application records always use a real user id.
CREATE TABLE rate_limits (
  user_id TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  PRIMARY KEY(user_id, bucket_key)
);

CREATE TABLE people (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE groups (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE tasks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE templates (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE notification_logs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE INDEX people_user_updated ON people(user_id, updated_at);
CREATE INDEX groups_user_updated ON groups(user_id, updated_at);
CREATE INDEX tasks_user_updated ON tasks(user_id, updated_at);
CREATE INDEX templates_user_updated ON templates(user_id, updated_at);
CREATE INDEX notification_logs_user_updated ON notification_logs(user_id, updated_at);
CREATE TABLE task_templates (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE message_templates (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE INDEX task_templates_user_updated ON task_templates(user_id, updated_at);
CREATE INDEX message_templates_user_updated ON message_templates(user_id, updated_at);
CREATE TABLE areas (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE sections (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE TABLE events (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, id)
);
CREATE INDEX areas_user_updated ON areas(user_id, updated_at);
CREATE INDEX sections_user_updated ON sections(user_id, updated_at);
CREATE INDEX events_user_updated ON events(user_id, updated_at);
