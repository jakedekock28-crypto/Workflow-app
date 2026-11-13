import { env, exports as workerExports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function createUser(id: string, email: string, token: string, workspaceId: string) {
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO users(id, email, email_verified_at, created_at, google_sub) VALUES(?, ?, ?, ?, ?)').bind(id, email, now, now, `google-${id}`).run();
  await env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(await digest(token), id, new Date(Date.now() + 60_000).toISOString(), now).run();
  await env.DB.prepare('INSERT INTO workspaces(id, name, owner_user_id, created_at) VALUES(?, ?, ?, ?)').bind(workspaceId, workspaceId, id, now).run();
  await env.DB.prepare("INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, 'owner', 'active', ?, ?)").bind(id, workspaceId, now, now).run();
}
async function request(path: string, token: string, workspaceId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Workspace-Id', workspaceId);
  if (init.body) headers.set('Content-Type', 'application/json');
  return workerExports.default.fetch(new Request(`https://workflow-api.test${path}`, { ...init, headers }));
}

const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);
const workspaceA = 'workspace-a';
const workspaceB = 'workspace-b';
const now = new Date().toISOString();
const person = (id: string, name: string) => JSON.stringify({ id, fullName: name, email: `${id}@example.test`, isActive: true });
const task = (id: string, assigneeIds: string[] = []) => ({ id, title: 'Prepare equipment', description: '', dueDate: '2026-12-01', status: 'todo', priority: 'medium', kind: 'delegated', assigneeIds, requirements: [], reminderSettings: {}, version: 1 });

describe('workspace data isolation and permissions', () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM workspaces WHERE id IN ('workspace-a', 'workspace-b')").run();
    await env.DB.prepare("DELETE FROM users WHERE id IN ('user-a', 'user-b', 'member-c')").run();
    await createUser('user-a', 'a@example.test', tokenA, workspaceA);
    await createUser('user-b', 'b@example.test', tokenB, workspaceB);
  });

  it('lists only records in the selected active workspace', async () => {
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'person-a', person('person-a', 'Alice'), now).run();
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceB, 'person-b', person('person-b', 'Bob'), now).run();
    const response = await request('/api/people', tokenA, workspaceA);
    expect(response.status).toBe(200);
    const result = await response.json() as { items: Array<{ id: string }> };
    expect(result.items.map(item => item.id)).toEqual(['person-a']);
  });

  it('rejects requests that guess another workspace id', async () => {
    const response = await request('/api/data', tokenA, workspaceB);
    expect(response.status).toBe(403);
  });

  it('cannot modify or delete another workspace record by guessing its id', async () => {
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceB, 'private-person', person('private-person', 'Private'), now).run();
    const update = await request('/api/people/private-person', tokenA, workspaceA, { method: 'PUT', body: JSON.stringify({ id: 'private-person', fullName: 'Changed', email: 'changed@example.test', isActive: true }) });
    const remove = await request('/api/people/private-person', tokenA, workspaceA, { method: 'DELETE' });
    expect(update.status).toBe(200);
    expect(remove.status).toBe(200);
    const stored = await env.DB.prepare('SELECT data_json FROM people WHERE workspace_id = ? AND id = ?').bind(workspaceB, 'private-person').first<{ data_json: string }>();
    expect(JSON.parse(stored!.data_json).fullName).toBe('Private');
  });

  it('rejects assigning a task to a contact from another workspace', async () => {
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceB, 'foreign-person', person('foreign-person', 'Other'), now).run();
    const response = await request('/api/tasks/task-a', tokenA, workspaceA, { method: 'PUT', body: JSON.stringify(task('task-a', ['foreign-person'])) });
    expect(response.status).toBe(400);
    expect(await env.DB.prepare('SELECT id FROM tasks WHERE workspace_id = ? AND id = ?').bind(workspaceA, 'task-a').first()).toBeNull();
  });

  it('revalidates membership on every request after removal', async () => {
    const when = new Date().toISOString();
    await env.DB.prepare('INSERT INTO users(id, email, email_verified_at, created_at, google_sub) VALUES(?, ?, ?, ?, ?)').bind('member-c', 'c@example.test', when, when, 'google-member-c').run();
    await env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(await digest('c'.repeat(64)), 'member-c', new Date(Date.now() + 60_000).toISOString(), when).run();
    await env.DB.prepare("INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, 'member', 'active', ?, ?)").bind('member-c', workspaceA, when, when).run();
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'person-c', JSON.stringify({ id: 'person-c', fullName: 'Member C', email: 'c@example.test', linkedUserId: 'member-c', isActive: true }), when).run();
    await env.DB.prepare('INSERT INTO groups(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'group-c', JSON.stringify({ id: 'group-c', name: 'Group', personIds: ['person-c'], isActive: true }), when).run();
    await env.DB.prepare('INSERT INTO tasks(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'task-c', JSON.stringify({ ...task('task-c', ['person-c']), createdByUserId: 'member-c' }), when).run();
    const remove = await request('/api/workspace/members/member-c', tokenA, workspaceA, { method: 'DELETE' });
    expect(remove.status).toBe(200);
    expect(await env.DB.prepare('SELECT user_id FROM memberships WHERE user_id = ? AND workspace_id = ?').bind('member-c', workspaceA).first()).toBeNull();
    expect(await env.DB.prepare('SELECT id FROM people WHERE id = ? AND workspace_id = ?').bind('person-c', workspaceA).first()).toBeNull();
    const group = await env.DB.prepare('SELECT data_json FROM groups WHERE id = ? AND workspace_id = ?').bind('group-c', workspaceA).first<{ data_json: string }>();
    expect(JSON.parse(group!.data_json).personIds).toEqual([]);
    const taskAfterRemoval = await env.DB.prepare('SELECT data_json FROM tasks WHERE id = ? AND workspace_id = ?').bind('task-c', workspaceA).first<{ data_json: string }>();
    expect(JSON.parse(taskAfterRemoval!.data_json)).toMatchObject({ assigneeIds: [] });
    expect(JSON.parse(taskAfterRemoval!.data_json)).not.toHaveProperty('createdByUserId');
    const later = await workerExports.default.fetch(new Request('https://workflow-api.test/api/data', { headers: { Authorization: `Bearer ${'c'.repeat(64)}`, 'X-Workspace-Id': workspaceA } }));
    expect(later.status).toBe(403);
  });

  it('limits a member to their assigned tasks and permitted fields', async () => {
    const when = new Date().toISOString();
    await env.DB.prepare('INSERT INTO users(id, email, email_verified_at, created_at, google_sub) VALUES(?, ?, ?, ?, ?)').bind('member-c', 'c@example.test', when, when, 'google-member-c').run();
    await env.DB.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, created_at) VALUES(?, ?, ?, ?)').bind(await digest('c'.repeat(64)), 'member-c', new Date(Date.now() + 60_000).toISOString(), when).run();
    await env.DB.prepare("INSERT INTO memberships(user_id, workspace_id, role, status, created_at, updated_at) VALUES(?, ?, 'member', 'active', ?, ?)").bind('member-c', workspaceA, when, when).run();
    await env.DB.prepare('INSERT INTO people(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'person-c', JSON.stringify({ id: 'person-c', fullName: 'Member C', email: 'c@example.test', isActive: true, linkedUserId: 'member-c' }), when).run();
    await env.DB.prepare('INSERT INTO tasks(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'assigned', JSON.stringify(task('assigned', ['person-c'])), when).run();
    await env.DB.prepare('INSERT INTO tasks(workspace_id, id, data_json, updated_at) VALUES(?, ?, ?, ?)').bind(workspaceA, 'other', JSON.stringify(task('other')), when).run();
    const list = await request('/api/tasks', 'c'.repeat(64), workspaceA);
    expect((await list.json() as { items: Array<{ id: string }> }).items.map(item => item.id)).toEqual(['assigned']);
    const changed = await request('/api/tasks/assigned', 'c'.repeat(64), workspaceA, { method: 'PUT', body: JSON.stringify({ ...task('assigned', ['person-c']), title: 'Changed title' }) });
    expect(changed.status).toBe(403);
  });
});
