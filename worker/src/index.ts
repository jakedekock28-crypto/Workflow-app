import { Hono, type MiddlewareHandler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

type Env = {
  DB: D1Database;
  APP_URL: string;
  APP_ENV: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  AUTH_DAILY_GLOBAL_LIMIT: string;
};
type Variables = { userId: string; userEmail: string };
type AppType = Hono<{ Bindings: Env; Variables: Variables }>;

const app: AppType = new Hono();
const SESSION_DAYS = 7;
const LINK_MINUTES = 10;
const MAX_JSON_BYTES = 1_000_000;
const SYSTEM_SCOPE = '__system__';

const personSchema = z.object({ id: z.string().min(1).max(100), fullName: z.string().min(1).max(160), roleOrRank: z.string().max(160).optional(), email: z.string().email().max(254).optional(), mobileNumber: z.string().regex(/^\+61\d{9}$/).optional(), preferredContact: z.enum(['email', 'sms', 'both']), notes: z.string().max(5000), isActive: z.boolean(), smsConsent: z.boolean() }).passthrough();
const groupSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160), personIds: z.array(z.string()).max(500), isActive: z.boolean() }).passthrough();
const checklistSchema = z.object({ id: z.string(), title: z.string().max(500), done: z.boolean() });
const taskSchema = z.object({ id: z.string().min(1).max(100), areaId: z.string().min(1), sectionId: z.string().optional(), eventId: z.string().optional(), title: z.string().min(1).max(500), description: z.string().max(10000), dueDate: z.string().max(40), dueTime: z.string().max(20).optional(), status: z.enum(['todo', 'doing', 'done']), priority: z.enum(['low', 'medium', 'high']), kind: z.enum(['mine', 'delegated']), assigneeIds: z.array(z.string()).max(500), requirements: z.array(checklistSchema).max(500), reminderSettings: z.record(z.string(), z.unknown()) }).passthrough();
const taskTemplateSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160), tasks: z.array(z.string().max(500)).max(500) }).passthrough();
const messageTemplateSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160), emailSubject: z.string().max(500), emailBody: z.string().max(20000), smsBody: z.string().max(2000) }).passthrough();
const logSchema = z.object({ id: z.string().min(1).max(100), taskId: z.string().min(1).max(100), personId: z.string().min(1).max(100), channel: z.enum(['email', 'sms']), sentAt: z.string().max(40), status: z.enum(['sent', 'failed']), messagePreview: z.string().max(500) }).passthrough();
const areaSchema = z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(160), color: z.string().max(30), icon: z.string().max(20) }).passthrough();
const sectionSchema = z.object({ id: z.string().min(1).max(100), areaId: z.string().min(1), name: z.string().min(1).max(160) }).passthrough();
const eventSchema = z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(500), date: z.string().max(40), areaId: z.string().min(1), sectionId: z.string().optional(), notes: z.string().max(20000) }).passthrough();
const dataSchema = z.object({ version: z.literal(2), people: z.array(personSchema).max(500), groups: z.array(groupSchema).max(500), tasks: z.array(taskSchema).max(1000), templates: z.array(taskTemplateSchema).max(500), messageTemplates: z.array(messageTemplateSchema).max(100), notificationLogs: z.array(logSchema).max(5000), areas: z.array(areaSchema).max(500), sections: z.array(sectionSchema).max(1000), events: z.array(eventSchema).max(2000), theme: z.enum(['light', 'dark', 'auto']), sampleData: z.boolean() }).passthrough();
const collectionConfig = {
  areas: { table: 'areas', schema: areaSchema },
  sections: { table: 'sections', schema: sectionSchema },
  events: { table: 'events', schema: eventSchema },
  people: { table: 'people', schema: personSchema },
  groups: { table: 'groups', schema: groupSchema },
  tasks: { table: 'tasks', schema: taskSchema },
  'task-templates': { table: 'task_templates', schema: taskTemplateSchema },
  templates: { table: 'message_templates', schema: messageTemplateSchema },
  'notification-logs': { table: 'notification_logs', schema: logSchema },
} as const;
type Collection = keyof typeof collectionConfig;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function expiry(minutesOrDays: number, unit: 'minutes' | 'days'): string {
  const delta = unit === 'minutes' ? minutesOrDays * 60_000 : minutesOrDays * 86_400_000;
  return new Date(Date.now() + delta).toISOString();
}
function emailValid(email: string): boolean {
  return z.string().email().safeParse(email).success && email.length <= 254;
}

async function bumpLimit(db: D1Database, userId: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare(`INSERT INTO rate_limits(user_id, bucket_key, count, window_start) VALUES(?, ?, 1, ?)
    ON CONFLICT(user_id, bucket_key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING count`).bind(userId, key, windowStart).first<{ count: number }>();
  return (result?.count ?? limit + 1) <= limit;
}

async function validateTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || token.length > 2048) return false;
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  }).then(response => response.json<{ success: boolean; hostname?: string; action?: string }>()).catch((): { success: boolean; hostname?: string; action?: string } => ({ success: false }));
  const expectedHost = new URL(env.APP_URL).hostname;
  const hostMatches = env.APP_ENV === 'development' || result.hostname === expectedHost;
  const actionMatches = !result.action || result.action === 'workflow_login';
  return result.success && hostMatches && actionMatches;
}

async function sendMagicLink(env: Env, email: string, link: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [email], subject: 'Your Workflow sign-in link', text: `Use this one-time link to sign in to Workflow. It expires in ${LINK_MINUTES} minutes.\n\n${link}\n\nIf you did not request this, ignore this email.` }),
  });
  return response.ok;
}

app.use('/auth/request-link', bodyLimit({ maxSize: 8192 }));
app.use('/auth/verify', bodyLimit({ maxSize: 1024 }));
app.use('/api/*', bodyLimit({ maxSize: MAX_JSON_BYTES }));
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigin = new URL(c.env.APP_URL).origin;
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403);
  if (origin) {
    c.header('Access-Control-Allow-Origin', allowedOrigin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    c.header('Vary', 'Origin');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.get('/health', c => json({ status: 'ok' }));
app.get('/auth/config', c => json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY, appUrl: c.env.APP_URL }));

app.post('/auth/request-link', zValidator('json', z.object({ email: z.string().email().max(254), turnstileToken: z.string().min(1).max(2048) })), async c => {
  const email = c.req.valid('json').email.trim().toLowerCase();
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  if (!await validateTurnstile(c.env, c.req.valid('json').turnstileToken, ip)) return json({ error: 'Please complete the security check and try again.' }, 400);

  const ipHash = await hash(ip);
  const dailyLimit = Math.min(90, Math.max(1, Number(c.env.AUTH_DAILY_GLOBAL_LIMIT) || 90));
  const day = new Date().toISOString().slice(0, 10);
  const emailHash = await hash(email);
  const perEmail = await bumpLimit(c.env.DB, SYSTEM_SCOPE, `email:${emailHash}:${day}`, 5, 86_400_000);
  const perIp = await bumpLimit(c.env.DB, SYSTEM_SCOPE, `ip:${ipHash}`, 10, 15 * 60_000);
  if (!perEmail || !perIp) return json({ message: 'If sign-in requests are within today’s limit, a link will arrive shortly.' });
  const global = await bumpLimit(c.env.DB, SYSTEM_SCOPE, `resend:${day}`, dailyLimit, 86_400_000);
  if (!global) return json({ message: 'If sign-in requests are within today’s limit, a link will arrive shortly.' });

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO users(id, email, created_at) VALUES(?, ?, ?) ON CONFLICT(email) DO NOTHING').bind(id, email, new Date().toISOString()).run();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) return json({ error: 'Unable to start sign in.' }, 500);
  await c.env.DB.prepare('DELETE FROM magic_links WHERE user_id = ?').bind(user.id).run();

  const rawToken = randomToken();
  const tokenHash = await hash(rawToken);
  const now = new Date().toISOString();
  await c.env.DB.prepare('DELETE FROM magic_links WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('INSERT INTO magic_links(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(tokenHash, user.id, expiry(LINK_MINUTES, 'minutes'), now).run();
  const destination = new URL(c.env.APP_URL);
  destination.hash = `magic=${rawToken}`;
  if (!await sendMagicLink(c.env, email, destination.toString())) return json({ error: 'Could not send the sign-in email. Try again later.' }, 502);
  return json({ message: 'If sign-in is available, a link will arrive shortly. Check your email.' });
});

app.post('/auth/verify', zValidator('json', z.object({ token: z.string().min(32).max(128) })), async c => {
  const tokenHash = await hash(c.req.valid('json').token);
  const now = new Date().toISOString();
  const challenge = await c.env.DB.prepare('UPDATE magic_links SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? RETURNING user_id').bind(now, tokenHash, now).first<{ user_id: string }>();
  if (!challenge) return json({ error: 'This sign-in link expired or was already used. Request a new link.' }, 401);
  const sessionToken = randomToken();
  const sessionHash = await hash(sessionToken);
  const expiresAt = expiry(SESSION_DAYS, 'days');
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(challenge.user_id).first<{ email: string }>();
  if (!user) return json({ error: 'Account not found.' }, 401);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').bind(now, challenge.user_id),
    c.env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(sessionHash, challenge.user_id, expiresAt, now),
  ]);
  return json({ token: sessionToken, expiresAt, user: { email: user.email } });
});

const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const authorization = c.req.header('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (token.length < 32 || token.length > 128) return json({ error: 'Sign in to use cloud mode.' }, 401);
  const tokenHash = await hash(token);
  const session = await c.env.DB.prepare(`SELECT sessions.user_id, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.user_id = users.id AND sessions.expires_at > ? AND users.email_verified_at IS NOT NULL`).bind(tokenHash, new Date().toISOString()).first<{ user_id: string; email: string }>();
  if (!session) return json({ error: 'Your session expired. Sign in again.' }, 401);
  c.set('userId', session.user_id);
  c.set('userEmail', session.email);
  await next();
};

app.get('/auth/me', requireAuth, c => json({ user: { email: c.get('userEmail') } }));
app.post('/auth/logout', requireAuth, async c => {
  const authorization = c.req.header('Authorization')!;
  const tokenHash = await hash(authorization.slice(7));
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash = ?').bind(c.get('userId'), tokenHash).run();
  return json({ ok: true });
});

async function hasIds(db: D1Database, table: 'areas' | 'sections' | 'events' | 'people' | 'groups' | 'tasks', userId: string, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ? AND id IN (${placeholders})`).bind(userId, ...ids).first<{ count: number }>();
  return result?.count === ids.length;
}
async function validateReferences(db: D1Database, userId: string, collection: Collection, value: Record<string, unknown>): Promise<boolean> {
  if (collection === 'sections') return hasIds(db, 'areas', userId, [value.areaId as string]);
  if (collection === 'events') return await hasIds(db, 'areas', userId, [value.areaId as string]) && (!value.sectionId || await hasIds(db, 'sections', userId, [value.sectionId as string]));
  if (collection === 'groups') return await hasIds(db, 'people', userId, value.personIds as string[]);
  if (collection === 'tasks') return await hasIds(db, 'people', userId, value.assigneeIds as string[]) && await hasIds(db, 'areas', userId, [value.areaId as string]) && (!value.sectionId || await hasIds(db, 'sections', userId, [value.sectionId as string])) && (!value.eventId || await hasIds(db, 'events', userId, [value.eventId as string]));
  if (collection === 'notification-logs') return await hasIds(db, 'tasks', userId, [value.taskId as string]) && await hasIds(db, 'people', userId, [value.personId as string]);
  return true;
}
async function listCollection(db: D1Database, userId: string, collection: Collection): Promise<unknown[]> {
  const { table } = collectionConfig[collection];
  const { results } = await db.prepare(`SELECT data_json FROM ${table} WHERE user_id = ? ORDER BY updated_at, id`).bind(userId).all<{ data_json: string }>();
  return results.map(row => JSON.parse(row.data_json));
}
function collectionValues(data: z.infer<typeof dataSchema>, collection: Collection): unknown[] {
  if (collection === 'task-templates') return data.templates;
  if (collection === 'templates') return data.messageTemplates;
  if (collection === 'notification-logs') return data.notificationLogs;
  return data[collection];
}
function hasUniqueIds(values: Array<{ id: string }>): boolean {
  return new Set(values.map(value => value.id)).size === values.length;
}
function importReferencesValid(data: z.infer<typeof dataSchema>): boolean {
  const areas = new Set(data.areas.map(item => item.id));
  const sections = new Set(data.sections.map(item => item.id));
  const people = new Set(data.people.map(item => item.id));
  const tasks = new Set(data.tasks.map(item => item.id));
  const sectionAreas = new Map(data.sections.map(item => [item.id, item.areaId]));
  const events = new Set(data.events.map(item => item.id));
  return hasUniqueIds(data.areas) && hasUniqueIds(data.sections) && hasUniqueIds(data.events) &&
    hasUniqueIds(data.people) && hasUniqueIds(data.groups) && hasUniqueIds(data.tasks) &&
    hasUniqueIds(data.templates) && hasUniqueIds(data.messageTemplates) && hasUniqueIds(data.notificationLogs) &&
    data.sections.every(item => areas.has(item.areaId)) &&
    data.events.every(item => areas.has(item.areaId) && (!item.sectionId || sectionAreas.get(item.sectionId) === item.areaId)) &&
    data.groups.every(item => item.personIds.every(id => people.has(id))) &&
    data.tasks.every(item => areas.has(item.areaId) && (!item.sectionId || sectionAreas.get(item.sectionId) === item.areaId) && (!item.eventId || events.has(item.eventId)) && item.assigneeIds.every(id => people.has(id))) &&
    data.notificationLogs.every(item => tasks.has(item.taskId) && people.has(item.personId));
}
function insertStatement(db: D1Database, userId: string, collection: Collection, value: { id: string }): D1PreparedStatement {
  const { table } = collectionConfig[collection];
  return db.prepare(`INSERT INTO ${table}(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)`)
    .bind(userId, value.id, JSON.stringify(value), new Date().toISOString());
}
async function replaceAllData(db: D1Database, userId: string, data: z.infer<typeof dataSchema>): Promise<void> {
  if (!importReferencesValid(data)) throw new Error('Import contains duplicate ids or references outside the imported account data.');
  const collections = Object.keys(collectionConfig) as Collection[];
  const statements = collections.map(collection => db.prepare(`DELETE FROM ${collectionConfig[collection].table} WHERE user_id = ?`).bind(userId));
  for (const collection of collections) {
    for (const value of collectionValues(data, collection)) statements.push(insertStatement(db, userId, collection, value as { id: string }));
  }
  await db.batch(statements);
}

async function getAllData(db: D1Database, userId: string): Promise<Record<string, unknown>> {
  const [areas, sections, events, people, groups, tasks, templates, messageTemplates, notificationLogs] = await Promise.all([
    listCollection(db, userId, 'areas'), listCollection(db, userId, 'sections'), listCollection(db, userId, 'events'),
    listCollection(db, userId, 'people'), listCollection(db, userId, 'groups'), listCollection(db, userId, 'tasks'),
    listCollection(db, userId, 'task-templates'), listCollection(db, userId, 'templates'), listCollection(db, userId, 'notification-logs'),
  ]);
  return { version: 2, areas, sections, events, people, groups, tasks, templates, messageTemplates, notificationLogs };
}

app.use('/api/*', requireAuth);
app.get('/api/data', async c => json(await getAllData(c.env.DB, c.get('userId'))));
app.post('/api/import', async c => {
  const length = Number(c.req.header('Content-Length') ?? 0);
  if (length > MAX_JSON_BYTES) return json({ error: 'Import is too large.' }, 413);
  const body = await c.req.json().catch(() => null);
  const parsed = dataSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Backup data is invalid.', details: parsed.error.issues.map(issue => issue.path.join('.')) }, 400);
  const entityCount = parsed.data.areas.length + parsed.data.sections.length + parsed.data.events.length + parsed.data.people.length + parsed.data.groups.length + parsed.data.tasks.length + parsed.data.templates.length + parsed.data.messageTemplates.length + parsed.data.notificationLogs.length;
  if (entityCount > 1800) return json({ error: 'This account import is over the 1,800-record limit. Split or remove archived records, then try again.' }, 413);
  const userId = c.get('userId');
  const owned = await Promise.all(Object.entries(collectionConfig).map(async ([, config]) => c.env.DB.prepare(`SELECT COUNT(*) AS count FROM ${config.table} WHERE user_id = ?`).bind(userId).first<{ count: number }>()));
  if (owned.some(result => (result?.count ?? 0) > 0)) return json({ error: 'This account already has cloud data. Import is allowed only into an empty account.' }, 409);
  try {
    await replaceAllData(c.env.DB, userId, parsed.data);
  } catch {
    return json({ error: 'Import contains duplicate ids or incomplete assignments.' }, 400);
  }
  return json({ ok: true, data: await getAllData(c.env.DB, userId) }, 201);
});

app.get('/api/:collection', async c => {
  const collection = c.req.param('collection') as Collection;
  if (!Object.hasOwn(collectionConfig, collection)) return json({ error: 'Unknown collection.' }, 404);
  return json({ items: await listCollection(c.env.DB, c.get('userId'), collection) });
});
app.put('/api/:collection/:id', async c => {
  const collection = c.req.param('collection') as Collection;
  const config = collectionConfig[collection];
  if (!Object.hasOwn(collectionConfig, collection) || !config) return json({ error: 'Unknown collection.' }, 404);
  const length = Number(c.req.header('Content-Length') ?? 0);
  if (length > 50_000) return json({ error: 'Record is too large.' }, 413);
  const parsed = config.schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Record is invalid.' }, 400);
  const userId = c.get('userId');
  if (parsed.data.id !== c.req.param('id')) return json({ error: 'Record id does not match the URL.' }, 400);
  if (!await validateReferences(c.env.DB, userId, collection, parsed.data as Record<string, unknown>)) return json({ error: 'One or more assigned records are not in your account.' }, 400);
  await c.env.DB.prepare(`INSERT INTO ${config.table}(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
    .bind(userId, parsed.data.id, JSON.stringify(parsed.data), new Date().toISOString()).run();
  return json({ item: parsed.data });
});
app.delete('/api/:collection/:id', async c => {
  const collection = c.req.param('collection') as Collection;
  const config = collectionConfig[collection];
  if (!Object.hasOwn(collectionConfig, collection) || !config) return json({ error: 'Unknown collection.' }, 404);
  const result = await c.env.DB.prepare(`DELETE FROM ${config.table} WHERE user_id = ? AND id = ?`).bind(c.get('userId'), c.req.param('id')).run();
  return json({ ok: true, deleted: result.meta.changes > 0 });
});

export default app;
