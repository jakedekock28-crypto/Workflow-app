ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  settings_json TEXT NOT NULL DEFAULT '{"membersSeeAllTasks":false,"auditRetentionDays":90}',
  created_at TEXT NOT NULL
);
CREATE TABLE memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','delegator','member')),
  status TEXT NOT NULL CHECK(status IN ('active','removed','left')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, workspace_id)
);
CREATE INDEX memberships_workspace_active ON memberships(workspace_id, status, user_id);
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','delegator','member')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','revoked','expired')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX invites_workspace_status ON invites(workspace_id, status, expires_at);
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_logs_workspace_created ON audit_logs(workspace_id, created_at);

INSERT INTO workspaces(id, name, owner_user_id, created_at)
SELECT 'personal-' || id, 'Personal workspace', id, created_at FROM users;
INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at)
SELECT id, 'personal-' || id, 'owner', 'active', created_at, created_at FROM users;
DELETE FROM sessions;
DROP TABLE magic_links;
DELETE FROM rate_limits;

DROP INDEX people_user_updated;
ALTER TABLE people RENAME TO people_user_v1;
CREATE TABLE people (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
INSERT INTO people(workspace_id, id, data_json, updated_at)
SELECT m.workspace_id, p.id,
  json_remove(p.data_json, '$.roleOrRank', '$.mobileNumber', '$.preferredContact', '$.notes', '$.smsConsent', '$.needsReview', '$.linkedUserId') , p.updated_at
FROM people_user_v1 p JOIN memberships m ON m.user_id = p.user_id;
DROP TABLE people_user_v1;
CREATE INDEX people_workspace_updated ON people(workspace_id, updated_at);

DROP INDEX groups_user_updated;
ALTER TABLE groups RENAME TO groups_user_v1;
CREATE TABLE groups (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
INSERT INTO groups SELECT m.workspace_id, g.id, g.data_json, g.updated_at FROM groups_user_v1 g JOIN memberships m ON m.user_id = g.user_id;
DROP TABLE groups_user_v1;
CREATE INDEX groups_workspace_updated ON groups(workspace_id, updated_at);

DROP INDEX tasks_user_updated;
ALTER TABLE tasks RENAME TO tasks_user_v1;
CREATE TABLE tasks (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
INSERT INTO tasks SELECT m.workspace_id, t.id, json_remove(t.data_json, '$.eventId', '$.areaId', '$.sectionId', '$.reminderChannel'), t.updated_at FROM tasks_user_v1 t JOIN memberships m ON m.user_id = t.user_id;
DROP TABLE tasks_user_v1;
CREATE INDEX tasks_workspace_updated ON tasks(workspace_id, updated_at);

DROP INDEX templates_user_updated;
ALTER TABLE templates RENAME TO templates_user_v1;
CREATE TABLE templates (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
INSERT INTO templates SELECT m.workspace_id, t.id, t.data_json, t.updated_at FROM templates_user_v1 t JOIN memberships m ON m.user_id = t.user_id;
DROP TABLE templates_user_v1;
CREATE INDEX templates_workspace_updated ON templates(workspace_id, updated_at);

DROP INDEX task_templates_user_updated;
DROP TABLE task_templates;

DROP INDEX message_templates_user_updated;
ALTER TABLE message_templates RENAME TO message_templates_user_v1;
CREATE TABLE message_templates (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)), updated_at TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
INSERT INTO message_templates SELECT m.workspace_id, t.id, json_remove(t.data_json, '$.smsBody'), t.updated_at FROM message_templates_user_v1 t JOIN memberships m ON m.user_id = t.user_id;
DROP TABLE message_templates_user_v1;
CREATE INDEX message_templates_workspace_updated ON message_templates(workspace_id, updated_at);
DROP TABLE message_templates;

-- Old notification logs contain message previews, so discard them during the privacy migration.
DROP INDEX notification_logs_user_updated;
DROP TABLE notification_logs;

-- Calendar notes and locations can contain sensitive operational details. They remain local-only.
DROP INDEX areas_user_updated;
DROP TABLE areas;
DROP INDEX sections_user_updated;
DROP TABLE sections;
DROP INDEX events_user_updated;
DROP TABLE events;
