import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { can, type Permission, type WorkspaceRole } from './permissions';

type Env = { DB: D1Database; APP_URL: string; GOOGLE_CLIENT_ID: string };
type Variables = { userId: string; userEmail: string; workspaceId: string; role: WorkspaceRole; workspaceSettings: WorkspaceSettings };
type AppType = Hono<{ Bindings: Env; Variables: Variables }>;
type WorkspaceSettings = { membersSeeAllTasks: boolean; auditRetentionDays: number };
type Collection = 'people' | 'groups' | 'tasks' | 'templates';
type RecordValue = { id: string; [key: string]: unknown };

const app: AppType = new Hono();
const SESSION_DAYS = 7;
const INVITE_DAYS = 7;
const MAX_JSON_BYTES = 1_000_000;
const SYSTEM_SCOPE = '__system__';
const personSchema = z.object({ id: z.string().min(1).max(100), fullName: z.string().trim().min(1).max(160), role: z.string().trim().max(80).optional(), email: z.string().email().max(254).optional(), linkedUserId: z.string().optional(), isActive: z.boolean() }).strict();
const groupSchema = z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(160), personIds: z.array(z.string()).max(500), isActive: z.boolean() }).strict();
const checklistSchema = z.object({ id: z.string().min(1).max(100), title: z.string().trim().max(500), done: z.boolean() }).strict();
const taskSchema = z.object({ id: z.string().min(1).max(100), title: z.string().trim().min(1).max(500), description: z.string().max(10000), dueDate: z.string().max(40), dueTime: z.string().max(20).optional(), status: z.enum(['todo', 'doing', 'done']), priority: z.enum(['low', 'medium', 'high']), kind: z.enum(['mine', 'delegated']), assigneeIds: z.array(z.string()).max(100), requirements: z.array(checklistSchema).max(100), subtasks: z.array(checklistSchema).max(100).optional(), recurrence: z.enum(['daily', 'weekly', 'fortnightly', 'monthly', 'custom']).optional(), recurrenceIntervalDays: z.number().int().min(1).max(365).optional(), reminderSettings: z.record(z.string(), z.unknown()), notes: z.string().max(3000).optional(), assignedBy: z.string().max(160).optional(), assignedAt: z.string().max(40).optional(), askedDate: z.string().max(40).optional(), remindBy: z.string().max(40).optional(), createdByUserId: z.string().optional(), version: z.number().int().positive().optional() }).strict();
const templateSchema = z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(160), tasks: z.array(z.string().max(500)).max(100) }).strict();
const dataSchema = z.object({ version: z.literal(3), people: z.array(personSchema).max(500), groups: z.array(groupSchema).max(500), tasks: z.array(taskSchema).max(1000), templates: z.array(templateSchema).max(200) }).strict();
const configs: Record<Collection, { table: string; schema: typeof personSchema | typeof groupSchema | typeof taskSchema | typeof templateSchema; permission: Permission }> = {
  people: { table: 'people', schema: personSchema, permission: 'data:manage' },
  groups: { table: 'groups', schema: groupSchema, permission: 'data:manage' },
  tasks: { table: 'tasks', schema: taskSchema, permission: 'task:list_all' },
  templates: { table: 'templates', schema: templateSchema, permission: 'data:manage' },
};

function json(data: unknown, status = 200): Response { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function randomToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''); }
async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function expiry(days: number): string { return new Date(Date.now() + days * 86_400_000).toISOString(); }
function parseSettings(jsonValue: string): WorkspaceSettings {
  try {
    const parsed = JSON.parse(jsonValue) as Partial<WorkspaceSettings>;
    return { membersSeeAllTasks: parsed.membersSeeAllTasks === true, auditRetentionDays: Math.min(365, Math.max(30, parsed.auditRetentionDays ?? 90)) };
  } catch { return { membersSeeAllTasks: false, auditRetentionDays: 90 }; }
}
async function bumpLimit(db: D1Database, scope: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await db.prepare(`INSERT INTO rate_limits(user_id, bucket_key, count, window_start) VALUES(?, ?, 1, ?)
    ON CONFLICT(user_id, bucket_key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
      window_start = excluded.window_start RETURNING count`).bind(scope, key, windowStart).first<{ count: number }>();
  return (row?.count ?? limit + 1) <= limit;
}

type GoogleClaims = { sub: string; email: string; email_verified: boolean; aud: string; iss: string; exp: number };
let googleKeys: { expiresAt: number; keys: Map<string, CryptoKey> } | undefined;
async function signingKeys(): Promise<Map<string, CryptoKey>> {
  if (googleKeys && googleKeys.expiresAt > Date.now()) return googleKeys.keys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!response.ok) throw new Error('Unable to verify Google sign-in.');
  const payload = await response.json() as { keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of payload.keys) if (jwk.kid && jwk.alg === 'RS256') keys.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  googleKeys = { keys, expiresAt: Date.now() + Math.min(maxAge, 86_400) * 1000 };
  return keys;
}
function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function verifyGoogleCredential(credential: string, clientId: string): Promise<GoogleClaims | null> {
  if (credential.length > 8192) return null;
  try {
    const [headerPart, claimsPart, signaturePart] = credential.split('.');
    if (!headerPart || !claimsPart || !signaturePart) return null;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(headerPart))) as { alg?: string; kid?: string };
    if (header.alg !== 'RS256' || !header.kid) return null;
    let key = (await signingKeys()).get(header.kid);
    if (!key) { googleKeys = undefined; key = (await signingKeys()).get(header.kid); }
    if (!key) return null;
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(signaturePart), new TextEncoder().encode(`${headerPart}.${claimsPart}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(claimsPart))) as GoogleClaims;
    if (!claims.sub || !z.string().email().safeParse(claims.email).success || !claims.email_verified || claims.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}

async function addAudit(db: D1Database, workspaceId: string, actor: string | null, action: string, entityType: string, entityId?: string, retentionDays = 90): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('INSERT INTO audit_logs(id, workspace_id, actor_user_id, action, entity_type, entity_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), workspaceId, actor, action, entityType, entityId ?? null, now),
    db.prepare('DELETE FROM audit_logs WHERE workspace_id = ? AND created_at < ?').bind(workspaceId, new Date(Date.now() - retentionDays * 86_400_000).toISOString()),
  ]);
}
function permission(permission: Permission): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    if (!can(c.get('role'), permission)) return json({ error: 'You do not have permission to do that.' }, 403);
    await next();
  };
}

app.use('/auth/google', bodyLimit({ maxSize: 12_000 }));
app.use('/api/*', bodyLimit({ maxSize: MAX_JSON_BYTES }));
app.use('*', async (c, next) => {
  const allowedOrigin = new URL(c.env.APP_URL).origin;
  const origin = c.req.header('Origin');
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403);
  if (origin) {
    c.header('Access-Control-Allow-Origin', allowedOrigin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Workspace-Id');
    c.header('Vary', 'Origin');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.get('/health', c => json({ status: 'ok' }));
app.get('/auth/config', c => json({ googleClientId: c.env.GOOGLE_CLIENT_ID }));
app.post('/auth/google', zValidator('json', z.object({ credential: z.string().min(100).max(8192) })), async c => {
  const ipHash = await hash(c.req.header('CF-Connecting-IP') ?? 'unknown');
  if (!await bumpLimit(c.env.DB, SYSTEM_SCOPE, `google-ip:${ipHash}`, 20, 15 * 60_000)) return json({ error: 'Sign-in is temporarily limited. Try again shortly.' }, 429);
  const claims = await verifyGoogleCredential(c.req.valid('json').credential, c.env.GOOGLE_CLIENT_ID);
  if (!claims) return json({ error: 'Google sign-in could not be verified.' }, 401);
  if (!await bumpLimit(c.env.DB, await hash(claims.sub), 'google-account-login', 30, 86_400_000)) return json({ error: 'Sign-in is temporarily limited. Try again tomorrow.' }, 429);
  const now = new Date().toISOString();
  const subjectUser = await c.env.DB.prepare('SELECT id, google_sub FROM users WHERE google_sub = ?').bind(claims.sub).first<{ id: string; google_sub: string }>();
  let userId = subjectUser?.id;
  if (!userId) {
    const legacyUser = await c.env.DB.prepare('SELECT id, google_sub FROM users WHERE email = ? COLLATE NOCASE').bind(claims.email.toLowerCase()).first<{ id: string; google_sub: string | null }>();
    if (legacyUser?.google_sub && legacyUser.google_sub !== claims.sub) return json({ error: 'Google sign-in could not be verified.' }, 401);
    userId = legacyUser?.id ?? crypto.randomUUID();
    await c.env.DB.prepare(`INSERT INTO users(id, email, email_verified_at, created_at, google_sub) VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email, email_verified_at = excluded.email_verified_at, google_sub = excluded.google_sub`).bind(userId, claims.email.toLowerCase(), now, now, claims.sub).run();
  } else {
    await c.env.DB.prepare('UPDATE users SET email = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').bind(claims.email.toLowerCase(), now, userId).run();
  }
  const hasMembership = await c.env.DB.prepare("SELECT 1 AS found FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1").bind(userId).first();
  if (!hasMembership) {
    const workspaceId = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO workspaces(id, name, owner_user_id, created_at) VALUES(?, ?, ?, ?)').bind(workspaceId, 'Personal workspace', userId, now),
      c.env.DB.prepare("INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, 'owner', 'active', ?, ?)").bind(userId, workspaceId, now, now),
    ]);
  }
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(await hash(token), userId, expiry(SESSION_DAYS), now).run();
  return json({ token, expiresAt: expiry(SESSION_DAYS), user: { email: claims.email.toLowerCase() } });
});

const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length < 32 || token.length > 128) return json({ error: 'Sign in to use cloud mode.' }, 401);
  const session = await c.env.DB.prepare(`SELECT sessions.user_id, users.email FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).bind(await hash(token), new Date().toISOString()).first<{ user_id: string; email: string }>();
  if (!session) return json({ error: 'Your session expired. Sign in again.' }, 401);
  c.set('userId', session.user_id); c.set('userEmail', session.email);
  await next();
};
const requireWorkspace: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const workspaceId = c.req.header('X-Workspace-Id') ?? '';
  if (!workspaceId || workspaceId.length > 100) return json({ error: 'Choose a workspace first.' }, 400);
  const row = await c.env.DB.prepare(`SELECT memberships.role, workspaces.settings_json FROM memberships JOIN workspaces ON workspaces.id = memberships.workspace_id
    WHERE memberships.user_id = ? AND memberships.workspace_id = ? AND memberships.status = 'active'`).bind(c.get('userId'), workspaceId).first<{ role: WorkspaceRole; settings_json: string }>();
  if (!row) return json({ error: 'You are not an active member of this workspace.' }, 403);
  c.set('workspaceId', workspaceId); c.set('role', row.role); c.set('workspaceSettings', parseSettings(row.settings_json));
  await next();
};
app.get('/auth/me', requireAuth, c => json({ user: { email: c.get('userEmail') } }));
app.post('/auth/logout', requireAuth, async c => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(c.req.header('Authorization')!.slice(7)).then(value => value)).run();
  return json({ ok: true });
});

app.use('/api/*', requireAuth);
app.get('/api/workspaces', async c => {
  const { results } = await c.env.DB.prepare(`SELECT workspaces.id, workspaces.name, workspaces.timezone, workspaces.settings_json, memberships.role
    FROM memberships JOIN workspaces ON workspaces.id = memberships.workspace_id
    WHERE memberships.user_id = ? AND memberships.status = 'active' ORDER BY workspaces.created_at`).bind(c.get('userId')).all<{ id: string; name: string; timezone: string; settings_json: string; role: WorkspaceRole }>();
  return json({ workspaces: results.map(item => ({ id: item.id, name: item.name, timezone: item.timezone, settings: parseSettings(item.settings_json), role: item.role })) });
});
app.post('/api/workspaces', zValidator('json', z.object({ name: z.string().trim().min(1).max(100) })), async c => {
  if (!await bumpLimit(c.env.DB, c.get('userId'), 'create-workspace', 5, 86_400_000)) return json({ error: 'Workspace creation is temporarily limited.' }, 429);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO workspaces(id, name, owner_user_id, created_at) VALUES(?, ?, ?, ?)').bind(id, c.req.valid('json').name, c.get('userId'), now),
    c.env.DB.prepare("INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, 'owner', 'active', ?, ?)").bind(c.get('userId'), id, now, now),
  ]);
  return json({ workspace: { id, name: c.req.valid('json').name, role: 'owner', timezone: 'Australia/Sydney', settings: { membersSeeAllTasks: false, auditRetentionDays: 90 } } }, 201);
});
app.post('/api/invites/accept', requireAuth, zValidator('json', z.object({ token: z.string().min(32).max(128) })), async c => {
  const tokenHash = await hash(c.req.valid('json').token);
  const invite = await c.env.DB.prepare("SELECT id, workspace_id, email, role FROM invites WHERE token_hash = ? AND status = 'pending' AND expires_at > ?").bind(tokenHash, new Date().toISOString()).first<{ id: string; workspace_id: string; email: string; role: Exclude<WorkspaceRole, 'owner'> }>();
  if (!invite || invite.email.toLowerCase() !== c.get('userEmail').toLowerCase()) return json({ error: 'This invite is invalid, expired, already used, or belongs to another signed-in account.' }, 400);
  const now = new Date().toISOString();
  const accepted = await c.env.DB.prepare("UPDATE invites SET status = 'accepted', accepted_by = ? WHERE id = ? AND status = 'pending' AND expires_at > ? RETURNING id").bind(c.get('userId'), invite.id, now).first();
  if (!accepted) return json({ error: 'This invite is invalid, expired, already used, or belongs to another signed-in account.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, ?, 'active', ?, ?)
      ON CONFLICT(user_id, workspace_id) DO UPDATE SET role = CASE WHEN memberships.status = 'active' THEN memberships.role ELSE excluded.role END, status = 'active', updated_at = excluded.updated_at`).bind(c.get('userId'), invite.workspace_id, invite.role, now, now),
    c.env.DB.prepare("UPDATE people SET data_json = json_set(data_json, '$.linkedUserId', ?) WHERE workspace_id = ? AND lower(json_extract(data_json, '$.email')) = lower(?)").bind(c.get('userId'), invite.workspace_id, c.get('userEmail')),
  ]);
  await addAudit(c.env.DB, invite.workspace_id, c.get('userId'), 'member.joined', 'membership', c.get('userId'));
  return json({ workspaceId: invite.workspace_id, ok: true });
});

app.use('/api/workspace/*', requireWorkspace);
app.use('/api/:collection/*', requireWorkspace);
app.use('/api/:collection', requireWorkspace);
app.get('/api/workspace', permission('workspace:read'), c => json({ id: c.get('workspaceId'), role: c.get('role'), settings: c.get('workspaceSettings') }));
app.patch('/api/workspace', zValidator('json', z.object({ name: z.string().trim().min(1).max(100).optional(), timezone: z.string().min(1).max(80).optional(), membersSeeAllTasks: z.boolean().optional(), auditRetentionDays: z.number().int().min(30).max(365).optional() })), permission('workspace:update'), async c => {
  const body = c.req.valid('json'); const current = await c.env.DB.prepare('SELECT name, timezone FROM workspaces WHERE id = ?').bind(c.get('workspaceId')).first<{ name: string; timezone: string }>();
  const settings = { ...c.get('workspaceSettings'), ...(body.membersSeeAllTasks === undefined ? {} : { membersSeeAllTasks: body.membersSeeAllTasks }), ...(body.auditRetentionDays === undefined ? {} : { auditRetentionDays: body.auditRetentionDays }) };
  await c.env.DB.prepare('UPDATE workspaces SET name = ?, timezone = ?, settings_json = ? WHERE id = ?').bind(body.name ?? current?.name, body.timezone ?? current?.timezone, JSON.stringify(settings), c.get('workspaceId')).run();
  return json({ ok: true });
});
app.post('/api/workspace/invites', zValidator('json', z.object({ email: z.string().trim().email().max(254), role: z.enum(['admin', 'delegator', 'member']) })), permission('invite:create'), async c => {
  const email = c.req.valid('json').email.toLowerCase();
  if (c.get('role') !== 'owner' && c.req.valid('json').role === 'admin') return json({ error: 'Only the owner can invite an admin.' }, 403);
  const workspaceId = c.get('workspaceId'); const userId = c.get('userId'); const emailHash = await hash(email); const day = new Date().toISOString().slice(0, 10);
  const allowed = await bumpLimit(c.env.DB, await hash(workspaceId), `invite:${emailHash}:${day}`, 5, 86_400_000) && await bumpLimit(c.env.DB, await hash(userId), `invite-user:${day}`, 10, 86_400_000) && await bumpLimit(c.env.DB, await hash(workspaceId), `invite-workspace:${day}`, 50, 86_400_000);
  if (!allowed) return json({ error: 'Invite creation is temporarily limited.' }, 429);
  const token = randomToken(); const id = crypto.randomUUID(); const now = new Date().toISOString();
  await c.env.DB.prepare("UPDATE invites SET status = 'revoked' WHERE workspace_id = ? AND lower(email) = lower(?) AND status = 'pending'").bind(workspaceId, email).run();
  await c.env.DB.prepare("INSERT INTO invites(id, workspace_id, email, role, token_hash, expires_at, status, created_by, created_at) VALUES(?, ?, ?, ?, ?, ?, 'pending', ?, ?)").bind(id, workspaceId, email, c.req.valid('json').role, await hash(token), expiry(INVITE_DAYS), userId, now).run();
  const url = new URL(c.env.APP_URL); url.hash = `invite=${token}`;
  await addAudit(c.env.DB, workspaceId, userId, 'invite.created', 'invite', id);
  return json({ invite: { id, email, role: c.req.valid('json').role, expiresAt: expiry(INVITE_DAYS), status: 'pending' }, link: url.toString() }, 201);
});
app.get('/api/workspace/invites', permission('member:manage'), async c => {
  const { results } = await c.env.DB.prepare("SELECT id, email, role, expires_at AS expiresAt, status, created_at AS createdAt FROM invites WHERE workspace_id = ? AND status = 'pending' AND expires_at > ? ORDER BY created_at DESC").bind(c.get('workspaceId'), new Date().toISOString()).all();
  return json({ invites: results });
});
app.delete('/api/workspace/invites/:inviteId', permission('invite:revoke'), async c => {
  const result = await c.env.DB.prepare("UPDATE invites SET status = 'revoked' WHERE workspace_id = ? AND id = ? AND status = 'pending'").bind(c.get('workspaceId'), c.req.param('inviteId')).run();
  await addAudit(c.env.DB, c.get('workspaceId'), c.get('userId'), 'invite.revoked', 'invite', c.req.param('inviteId'));
  return json({ ok: true, changed: result.meta.changes > 0 });
});
app.get('/api/workspace/members', permission('member:manage'), async c => {
  const { results } = await c.env.DB.prepare(`SELECT users.id, users.email, memberships.role, memberships.status, memberships.created_at AS joinedAt
    FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.workspace_id = ? ORDER BY memberships.created_at`).bind(c.get('workspaceId')).all();
  return json({ members: results });
});
app.patch('/api/workspace/members/:memberId', zValidator('json', z.object({ role: z.enum(['admin', 'delegator', 'member']) })), permission('member:manage'), async c => {
  const target = c.req.param('memberId');
  const row = await c.env.DB.prepare('SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = \'active\'').bind(c.get('workspaceId'), target).first<{ role: WorkspaceRole }>();
  if (!row || row.role === 'owner' || (c.get('role') !== 'owner' && (row.role === 'admin' || c.req.valid('json').role === 'admin'))) return json({ error: 'That member cannot be changed by your role.' }, 403);
  await c.env.DB.prepare('UPDATE memberships SET role = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ?').bind(c.req.valid('json').role, new Date().toISOString(), c.get('workspaceId'), target).run();
  await addAudit(c.env.DB, c.get('workspaceId'), c.get('userId'), 'member.role_changed', 'membership', target);
  return json({ ok: true });
});
async function removeMember(db: D1Database, workspaceId: string, userId: string, actor: string, retentionDays: number): Promise<Response> {
  const member = await db.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'").bind(workspaceId, userId).first<{ role: WorkspaceRole }>();
  if (!member) return json({ error: 'That member is not active in this workspace.' }, 404);
  if (member.role === 'owner') {
    const ownerCount = await db.prepare("SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND role = 'owner' AND status = 'active'").bind(workspaceId).first<{ count: number }>();
    if ((ownerCount?.count ?? 0) <= 1) return json({ error: 'Transfer ownership before removing the last owner.' }, 409);
  }
  const peopleRows = await db.prepare('SELECT id, data_json FROM people WHERE workspace_id = ?').bind(workspaceId).all<{ id: string; data_json: string }>();
  const personIds = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  for (const person of peopleRows.results) {
    const data = JSON.parse(person.data_json) as RecordValue;
    if (data.linkedUserId === userId) { personIds.add(person.id); statements.push(db.prepare('DELETE FROM people WHERE workspace_id = ? AND id = ?').bind(workspaceId, person.id)); }
  }
  const groupRows = await db.prepare('SELECT id, data_json FROM groups WHERE workspace_id = ?').bind(workspaceId).all<{ id: string; data_json: string }>();
  for (const group of groupRows.results) {
    const data = JSON.parse(group.data_json) as RecordValue;
    const groupPersonIds = (data.personIds as string[] | undefined) ?? [];
    const filtered = groupPersonIds.filter(id => !personIds.has(id));
    if (filtered.length !== groupPersonIds.length) statements.push(db.prepare('UPDATE groups SET data_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').bind(JSON.stringify({ ...data, personIds: filtered }), new Date().toISOString(), workspaceId, group.id));
  }
  const taskRows = await db.prepare('SELECT id, data_json FROM tasks WHERE workspace_id = ?').bind(workspaceId).all<{ id: string; data_json: string }>();
  for (const task of taskRows.results) {
    const data = JSON.parse(task.data_json) as RecordValue;
    const assigned = (data.assigneeIds as string[] | undefined) ?? [];
    if (assigned.some(id => personIds.has(id)) || data.createdByUserId === userId) {
      const next = { ...data, assigneeIds: assigned.filter(id => !personIds.has(id)), createdByUserId: data.createdByUserId === userId ? undefined : data.createdByUserId };
      statements.push(db.prepare('UPDATE tasks SET data_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').bind(JSON.stringify(next), new Date().toISOString(), workspaceId, task.id));
    }
  }
  statements.push(db.prepare('DELETE FROM memberships WHERE workspace_id = ? AND user_id = ?').bind(workspaceId, userId));
  statements.push(db.prepare('DELETE FROM audit_logs WHERE workspace_id = ? AND (actor_user_id = ? OR (entity_type = \'membership\' AND entity_id = ?))').bind(workspaceId, userId, userId));
  await db.batch(statements);
  await addAudit(db, workspaceId, actor, 'member.removed', 'membership', undefined, retentionDays);
  return json({ ok: true });
}
app.delete('/api/workspace/members/:memberId', permission('member:manage'), async c => {
  const target = c.req.param('memberId');
  if (c.get('role') !== 'owner' && target === c.get('userId')) return json({ error: 'Use leave workspace for your own membership.' }, 400);
  const member = await c.env.DB.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'").bind(c.get('workspaceId'), target).first<{ role: WorkspaceRole }>();
  if (!member || (member.role === 'owner' && c.get('role') !== 'owner')) return json({ error: 'That member cannot be removed by your role.' }, 403);
  return removeMember(c.env.DB, c.get('workspaceId'), target, c.get('userId'), c.get('workspaceSettings').auditRetentionDays);
});
app.post('/api/workspace/leave', async c => {
  const member = await c.env.DB.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'").bind(c.get('workspaceId'), c.get('userId')).first<{ role: WorkspaceRole }>();
  if (member?.role === 'owner') return json({ error: 'Transfer ownership before leaving this workspace.' }, 409);
  return removeMember(c.env.DB, c.get('workspaceId'), c.get('userId'), c.get('userId'), c.get('workspaceSettings').auditRetentionDays);
});
app.post('/api/workspace/transfer', zValidator('json', z.object({ memberId: z.string().min(1).max(100) })), permission('workspace:update'), async c => {
  const nextOwner = c.req.valid('json').memberId; const workspaceId = c.get('workspaceId'); const now = new Date().toISOString();
  const active = await c.env.DB.prepare("SELECT 1 FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'").bind(workspaceId, nextOwner).first();
  if (!active) return json({ error: 'The new owner must be an active member.' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE memberships SET role = 'admin', updated_at = ? WHERE workspace_id = ? AND user_id = ? AND role = 'owner'").bind(now, workspaceId, c.get('userId')),
    c.env.DB.prepare("UPDATE memberships SET role = 'owner', updated_at = ? WHERE workspace_id = ? AND user_id = ?").bind(now, workspaceId, nextOwner),
    c.env.DB.prepare('UPDATE workspaces SET owner_user_id = ? WHERE id = ?').bind(nextOwner, workspaceId),
  ]);
  await addAudit(c.env.DB, workspaceId, c.get('userId'), 'workspace.ownership_transferred', 'workspace', workspaceId);
  return json({ ok: true });
});
app.delete('/api/workspace', permission('workspace:delete'), async c => {
  await c.env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(c.get('workspaceId')).run();
  return json({ ok: true });
});

app.get('/api/audit', permission('audit:read'), async c => {
  const { results } = await c.env.DB.prepare('SELECT id, actor_user_id AS actorUserId, action, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt FROM audit_logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 500').bind(c.get('workspaceId')).all();
  return json({ entries: results });
});

async function listRows(db: D1Database, workspaceId: string, collection: Collection): Promise<RecordValue[]> {
  const { results } = await db.prepare(`SELECT data_json FROM ${configs[collection].table} WHERE workspace_id = ? ORDER BY updated_at, id`).bind(workspaceId).all<{ data_json: string }>();
  return results.map(row => JSON.parse(row.data_json) as RecordValue);
}
async function visibleTasks(c: Context<{ Bindings: Env; Variables: Variables }>, all: RecordValue[]): Promise<RecordValue[]> {
  const role = c.get('role') as WorkspaceRole;
  if (can(role, 'task:list_all') || c.get('workspaceSettings').membersSeeAllTasks) return all;
  const linked = await c.env.DB.prepare("SELECT id FROM people WHERE workspace_id = ? AND json_extract(data_json, '$.linkedUserId') = ?").bind(c.get('workspaceId'), c.get('userId')).all<{ id: string }>();
  const personIds = new Set(linked.results.map(item => item.id));
  return all.filter(task => task.createdByUserId === c.get('userId') || ((task.assigneeIds as string[] | undefined) ?? []).some(id => personIds.has(id)));
}
async function workspaceData(c: Context<{ Bindings: Env; Variables: Variables }>): Promise<Record<string, unknown>> {
  const [people, groups, tasks, templates] = await Promise.all((['people', 'groups', 'tasks', 'templates'] as Collection[]).map(collection => listRows(c.env.DB, c.get('workspaceId'), collection)));
  const tasksVisible = await visibleTasks(c, tasks);
  const role = c.get('role') as WorkspaceRole;
  if (role === 'member' && !c.get('workspaceSettings').membersSeeAllTasks) {
    const visiblePeople = new Set(tasksVisible.flatMap(task => (task.assigneeIds as string[] | undefined) ?? []));
    const linked = people.filter(person => person.linkedUserId === c.get('userId')).map(person => person.id);
    for (const id of linked) visiblePeople.add(id);
    return { version: 3, people: people.filter(person => visiblePeople.has(person.id)), groups: [], tasks: tasksVisible, templates: [] };
  }
  return { version: 3, people, groups, tasks: tasksVisible, templates };
}
app.get('/api/data', permission('workspace:read'), async c => json(await workspaceData(c)));
app.get('/api/export', permission('export'), async c => {
  const workspaceId = c.get('workspaceId');
  const [workspace, members, invites, audit, data] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, owner_user_id AS ownerUserId, timezone, settings_json AS settings, created_at AS createdAt FROM workspaces WHERE id = ?').bind(workspaceId).first(),
    c.env.DB.prepare("SELECT users.id, users.email, memberships.role, memberships.status, memberships.created_at AS joinedAt FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.workspace_id = ? ORDER BY memberships.created_at").bind(workspaceId).all(),
    c.env.DB.prepare('SELECT email, role, expires_at AS expiresAt, status, created_at AS createdAt FROM invites WHERE workspace_id = ? ORDER BY created_at').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT actor_user_id AS actorUserId, action, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt FROM audit_logs WHERE workspace_id = ? ORDER BY created_at').bind(workspaceId).all(),
    workspaceData(c),
  ]);
  return json({ workspace, members: members.results, invites: invites.results, audit: audit.results, data, exportedAt: new Date().toISOString() });
});
app.delete('/api/tasks/completed', permission('task:delete'), async c => {
  const result = await c.env.DB.prepare("DELETE FROM tasks WHERE workspace_id = ? AND json_extract(data_json, '$.status') = 'done'").bind(c.get('workspaceId')).run();
  if (result.meta.changes > 0) await addAudit(c.env.DB, c.get('workspaceId'), c.get('userId'), 'tasks.completed_deleted', 'tasks', undefined, c.get('workspaceSettings').auditRetentionDays);
  return json({ ok: true, deleted: result.meta.changes });
});
app.post('/api/import', permission('data:manage'), async c => {
  const parsed = dataSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Import data is invalid.' }, 400);
  const count = parsed.data.people.length + parsed.data.groups.length + parsed.data.tasks.length + parsed.data.templates.length;
  if (count > 1800) return json({ error: 'This import is over the 1,800-record limit.' }, 413);
  const ws = c.get('workspaceId');
  const existing = await Promise.all((Object.keys(configs) as Collection[]).map(async collection => c.env.DB.prepare(`SELECT COUNT(*) AS count FROM ${configs[collection].table} WHERE workspace_id = ?`).bind(ws).first<{ count: number }>()));
  if (existing.some(row => (row?.count ?? 0) > 0)) return json({ error: 'Import is only available in an empty workspace.' }, 409);
  const statements: D1PreparedStatement[] = [];
  for (const collection of Object.keys(configs) as Collection[]) {
    const values = parsed.data[collection];
    for (const value of values) statements.push(c.env.DB.prepare(`INSERT INTO ${configs[collection].table}(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)`).bind(ws, value.id, JSON.stringify(value), new Date().toISOString()));
  }
  const peopleIds = new Set(parsed.data.people.map(item => item.id));
  if (parsed.data.groups.some(item => item.personIds.some(id => !peopleIds.has(id))) || parsed.data.tasks.some(item => item.assigneeIds.some(id => !peopleIds.has(id)))) return json({ error: 'Import contains assignments to people outside this workspace.' }, 400);
  await c.env.DB.batch(statements);
  return json({ ok: true, data: await workspaceData(c) }, 201);
});
app.get('/api/:collection', permission('workspace:read'), async c => {
  const collection = c.req.param('collection') as Collection;
  if (!Object.hasOwn(configs, collection)) return json({ error: 'Unknown collection.' }, 404);
  if (!can(c.get('role'), configs[collection].permission) && collection !== 'tasks') return json({ error: 'You do not have permission to view this collection.' }, 403);
  const items = await listRows(c.env.DB, c.get('workspaceId'), collection);
  return json({ items: collection === 'tasks' ? await visibleTasks(c, items) : items });
});
app.put('/api/:collection/:id', async c => {
  const collection = c.req.param('collection') as Collection;
  if (!Object.hasOwn(configs, collection)) return json({ error: 'Unknown collection.' }, 404);
  const config = configs[collection];
  const raw = await c.req.json().catch(() => null);
  const parsed = config.schema.safeParse(raw);
  if (!parsed.success) return json({ error: 'Record is invalid.' }, 400);
  const value = parsed.data as RecordValue; const workspaceId = c.get('workspaceId'); const userId = c.get('userId');
  if (value.id !== c.req.param('id')) return json({ error: 'Record id does not match the request.' }, 400);
  if (collection !== 'tasks' && !can(c.get('role'), config.permission)) return json({ error: 'You do not have permission to change this record.' }, 403);
  let action = 'record.edited';
  if (collection === 'people' && value.linkedUserId) return json({ error: 'Linked accounts are managed through membership.' }, 400);
  if (collection === 'people') {
    const existingPerson = await c.env.DB.prepare('SELECT data_json FROM people WHERE workspace_id = ? AND id = ?').bind(workspaceId, value.id).first<{ data_json: string }>();
    if (existingPerson) value.linkedUserId = (JSON.parse(existingPerson.data_json) as RecordValue).linkedUserId;
  }
  if (collection === 'groups') {
    for (const id of value.personIds as string[]) if (!await c.env.DB.prepare('SELECT 1 FROM people WHERE workspace_id = ? AND id = ?').bind(workspaceId, id).first()) return json({ error: 'Group members must belong to this workspace.' }, 400);
  }
  if (collection === 'tasks') {
    const assigneeIds = value.assigneeIds as string[];
    for (const id of assigneeIds) if (!await c.env.DB.prepare('SELECT 1 FROM people WHERE workspace_id = ? AND id = ?').bind(workspaceId, id).first()) return json({ error: 'Task assignees must belong to this workspace.' }, 400);
    const existing = await c.env.DB.prepare('SELECT data_json FROM tasks WHERE workspace_id = ? AND id = ?').bind(workspaceId, value.id).first<{ data_json: string }>();
    const previous = existing ? JSON.parse(existing.data_json) as RecordValue : null;
    const role = c.get('role');
    if (!previous) {
      if (!can(role, 'task:create')) return json({ error: 'You cannot create tasks with this role.' }, 403);
      value.createdByUserId = userId; value.version = 1; action = assigneeIds.length ? 'task.assigned' : 'task.created';
    } else if (can(role, 'task:update_any')) {
      value.createdByUserId = previous.createdByUserId ?? userId; value.version = (previous.version as number | undefined ?? 0) + 1;
      action = previous.status !== 'done' && value.status === 'done' ? 'task.completed' : JSON.stringify(previous.assigneeIds) !== JSON.stringify(value.assigneeIds) ? 'task.assigned' : 'task.edited';
    } else if (can(role, 'task:update_assigned')) {
      const person = await c.env.DB.prepare("SELECT id FROM people WHERE workspace_id = ? AND json_extract(data_json, '$.linkedUserId') = ?").bind(workspaceId, userId).first<{ id: string }>();
      const assignedToCaller = person && ((previous.assigneeIds as string[] | undefined) ?? []).includes(person.id);
      const createdByCaller = previous.createdByUserId === userId && role === 'delegator';
      if (!assignedToCaller && !createdByCaller) return json({ error: 'You can only change tasks assigned to you or created by you.' }, 403);
      if (role === 'member' && assignedToCaller) {
        const changedRequirements = (value.requirements as Array<RecordValue>).length === ((previous.requirements as Array<RecordValue> | undefined) ?? []).length && (value.requirements as Array<RecordValue>).every((item, index) => {
          const old = ((previous.requirements as Array<RecordValue> | undefined) ?? [])[index]; return old && item.id === old.id && item.title === old.title;
        });
        const mutable = new Set(['status', 'requirements', 'notes', 'version']);
        const protectedChanged = Object.keys(previous).some(key => !mutable.has(key) && JSON.stringify(previous[key]) !== JSON.stringify(value[key]));
        if (protectedChanged || !changedRequirements) return json({ error: 'Members can update task status, checklist progress, and notes only.' }, 403);
      }
      value.createdByUserId = previous.createdByUserId; value.version = (previous.version as number | undefined ?? 0) + 1;
      action = previous.status !== 'done' && value.status === 'done' ? 'task.completed' : 'task.edited';
    } else return json({ error: 'You cannot change tasks with this role.' }, 403);
  }
  await c.env.DB.prepare(`INSERT INTO ${config.table}(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)
    ON CONFLICT(workspace_id, id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`).bind(workspaceId, value.id, JSON.stringify(value), new Date().toISOString()).run();
  await addAudit(c.env.DB, workspaceId, userId, action, collection === 'tasks' ? 'task' : collection.slice(0, -1), value.id, c.get('workspaceSettings').auditRetentionDays);
  return json({ item: value });
});
app.delete('/api/:collection/:id', async c => {
  const collection = c.req.param('collection') as Collection;
  if (!Object.hasOwn(configs, collection)) return json({ error: 'Unknown collection.' }, 404);
  const workspaceId = c.get('workspaceId'); const id = c.req.param('id'); const userId = c.get('userId');
  let result: D1Result;
  if (collection === 'tasks') {
    const record = await c.env.DB.prepare('SELECT data_json FROM tasks WHERE workspace_id = ? AND id = ?').bind(workspaceId, id).first<{ data_json: string }>();
    const task = record ? JSON.parse(record.data_json) as RecordValue : null;
    if (!can(c.get('role'), 'task:delete') && !(can(c.get('role'), 'task:delete_own') && task?.createdByUserId === userId)) return json({ error: 'You do not have permission to delete this task.' }, 403);
    result = await c.env.DB.prepare('DELETE FROM tasks WHERE workspace_id = ? AND id = ?').bind(workspaceId, id).run();
  } else {
    if (!can(c.get('role'), 'data:manage')) return json({ error: 'You do not have permission to delete this item.' }, 403);
    if (collection === 'people') {
      const groups = await c.env.DB.prepare('SELECT id, data_json FROM groups WHERE workspace_id = ?').bind(workspaceId).all<{ id: string; data_json: string }>();
      const tasks = await c.env.DB.prepare('SELECT id, data_json FROM tasks WHERE workspace_id = ?').bind(workspaceId).all<{ id: string; data_json: string }>();
      const updates: D1PreparedStatement[] = [];
      for (const row of groups.results) { const group = JSON.parse(row.data_json) as RecordValue; const ids = group.personIds as string[]; if (ids.includes(id)) updates.push(c.env.DB.prepare('UPDATE groups SET data_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').bind(JSON.stringify({ ...group, personIds: ids.filter(personId => personId !== id) }), new Date().toISOString(), workspaceId, row.id)); }
      for (const row of tasks.results) { const task = JSON.parse(row.data_json) as RecordValue; const ids = task.assigneeIds as string[]; if (ids.includes(id)) updates.push(c.env.DB.prepare('UPDATE tasks SET data_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').bind(JSON.stringify({ ...task, assigneeIds: ids.filter(personId => personId !== id) }), new Date().toISOString(), workspaceId, row.id)); }
      if (updates.length) await c.env.DB.batch(updates);
    }
    result = await c.env.DB.prepare(`DELETE FROM ${configs[collection].table} WHERE workspace_id = ? AND id = ?`).bind(workspaceId, id).run();
  }
  if (result.meta.changes > 0) await addAudit(c.env.DB, workspaceId, userId, collection === 'tasks' ? 'task.removed' : `${collection.slice(0, -1)}.removed`, collection === 'tasks' ? 'task' : collection.slice(0, -1), id, c.get('workspaceSettings').auditRetentionDays);
  return json({ ok: true, deleted: result.meta.changes > 0 });
});

app.delete('/auth/account', requireAuth, async c => {
  const user = await c.env.DB.prepare('SELECT email, google_sub FROM users WHERE id = ?').bind(c.get('userId')).first<{ email: string; google_sub: string | null }>();
  const memberships = await c.env.DB.prepare("SELECT memberships.workspace_id, memberships.role, COUNT(CASE WHEN other.status = 'active' AND other.user_id != memberships.user_id THEN 1 END) AS others, SUM(CASE WHEN other.role = 'owner' AND other.status = 'active' THEN 1 ELSE 0 END) AS owners FROM memberships JOIN memberships other ON other.workspace_id = memberships.workspace_id WHERE memberships.user_id = ? AND memberships.status = 'active' GROUP BY memberships.workspace_id, memberships.role").bind(c.get('userId')).all<{ workspace_id: string; role: WorkspaceRole; others: number; owners: number }>();
  if (memberships.results.some(item => item.role === 'owner' && item.others > 0 && item.owners <= 1)) return json({ error: 'Transfer ownership or remove workspace members before deleting this account.' }, 409);
  for (const item of memberships.results) {
    if (item.role !== 'owner') continue;
    const ownsWorkspace = await c.env.DB.prepare('SELECT 1 FROM workspaces WHERE id = ? AND owner_user_id = ?').bind(item.workspace_id, c.get('userId')).first();
    if (ownsWorkspace && item.others > 0) return json({ error: 'Transfer ownership or remove all other workspace members before deleting this account.' }, 409);
  }
  for (const item of memberships.results) {
    if (item.role === 'owner' && item.others === 0) await c.env.DB.prepare('DELETE FROM workspaces WHERE id = ?').bind(item.workspace_id).run();
    else await removeMember(c.env.DB, item.workspace_id, c.get('userId'), c.get('userId'), 90);
  }
  if (user) {
    const emailHash = await hash(user.email.toLowerCase());
    const subjectHash = user.google_sub ? await hash(user.google_sub) : '';
    await c.env.DB.prepare('DELETE FROM invites WHERE lower(email) = lower(?)').bind(user.email).run();
    await c.env.DB.prepare('DELETE FROM rate_limits WHERE user_id = ? OR user_id = ? OR bucket_key LIKE ?').bind(await hash(c.get('userId')), subjectHash, `invite:${emailHash}:%`).run();
  }
  await c.env.DB.prepare('DELETE FROM audit_logs WHERE actor_user_id = ?').bind(c.get('userId')).run();
  await c.env.DB.prepare("DELETE FROM audit_logs WHERE entity_type = 'membership' AND entity_id = ?").bind(c.get('userId')).run();
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(c.get('userId')).run();
  return json({ ok: true });
});

const worker = {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await Promise.all([
      env.DB.prepare(`DELETE FROM audit_logs WHERE datetime(created_at) < datetime('now', '-' ||
        COALESCE((SELECT json_extract(settings_json, '$.auditRetentionDays') FROM workspaces WHERE id = audit_logs.workspace_id), 90) || ' days')`).run(),
      env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Date.now() - 30 * 86_400_000).run(),
    ]);
  },
};
export default worker;
