import { env, exports as workerExports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function createUser(id: string, email: string, token: string) {
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO users(id, email, email_verified_at, created_at) VALUES(?, ?, ?, ?)').bind(id, email, now, now).run();
  await env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(await digest(token), id, new Date(Date.now() + 60_000).toISOString(), now).run();
}
async function request(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  return workerExports.default.fetch(new Request(`https://workflow-api.test${path}`, { ...init, headers }));
}

const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);

describe('account data isolation', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM users WHERE id IN (?, ?)').bind('user-a', 'user-b').run();
    await createUser('user-a', 'a@example.test', tokenA);
    await createUser('user-b', 'b@example.test', tokenB);
  });

  it('only lists records owned by the authenticated account', async () => {
    for (const [userId, id, name] of [['user-a', 'person-a', 'Alice'], ['user-b', 'person-b', 'Bob']]) {
      const value = JSON.stringify({ id, fullName: name, isActive: true, preferredContact: 'email', notes: '', smsConsent: false });
      await env.DB.prepare('INSERT INTO people(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(userId, id, value, new Date().toISOString()).run();
    }
    const response = await request('/api/people', tokenA);
    expect(response.status).toBe(200);
    const result = await response.json() as { items: Array<{ id: string }> };
    expect(result.items.map(item => item.id)).toEqual(['person-a']);
  });

  it('cannot update or delete another user record by guessing its id', async () => {
    const value = JSON.stringify({ id: 'private-person', fullName: 'Private', isActive: true, preferredContact: 'email', notes: '', smsConsent: false });
    await env.DB.prepare('INSERT INTO people(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind('user-b', 'private-person', value, new Date().toISOString()).run();
    const update = await request('/api/people/private-person', tokenA, { method: 'PUT', body: JSON.stringify({ id: 'private-person', fullName: 'Changed', preferredContact: 'email', notes: '', smsConsent: false, isActive: true }) });
    const remove = await request('/api/people/private-person', tokenA, { method: 'DELETE' });
    expect(update.status).toBe(200);
    expect(remove.status).toBe(200);
    const stored = await env.DB.prepare('SELECT data_json FROM people WHERE user_id = ? AND id = ?').bind('user-b', 'private-person').first<{ data_json: string }>();
    expect(JSON.parse(stored!.data_json).fullName).toBe('Private');
    const own = await env.DB.prepare('SELECT data_json FROM people WHERE user_id = ? AND id = ?').bind('user-a', 'private-person').first();
    expect(own).toBeNull();
  });

  it('rejects assignments to a contact owned by another account', async () => {
    await env.DB.prepare('INSERT INTO areas(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind('user-a', 'area-a', JSON.stringify({ id: 'area-a', name: 'A', color: '#000', icon: 'A' }), new Date().toISOString()).run();
    await env.DB.prepare('INSERT INTO people(user_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind('user-b', 'foreign-person', JSON.stringify({ id: 'foreign-person' }), new Date().toISOString()).run();
    const response = await request('/api/tasks/task-a', tokenA, { method: 'PUT', body: JSON.stringify({ id: 'task-a', title: 'No cross-account assignment', description: '', dueDate: '', status: 'todo', priority: 'medium', kind: 'delegated', assigneeIds: ['foreign-person'], requirements: [], reminderSettings: {} }) });
    expect(response.status).toBe(400);
    const row = await env.DB.prepare('SELECT id FROM tasks WHERE user_id = ? AND id = ?').bind('user-a', 'task-a').first();
    expect(row).toBeNull();
  });
});
