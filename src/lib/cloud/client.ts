import type { AppData, Task } from '../../types';

const sessionKey = 'workflow-cloud-session';
const workspaceKey = 'workflow-cloud-workspace';
export const cloudApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export interface CloudSession {
  token: string;
  expiresAt: string;
  user: { email: string };
}
export interface CloudWorkspace {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'delegator' | 'member';
  timezone: string;
  settings: { membersSeeAllTasks: boolean; auditRetentionDays: number };
}
export interface WorkspaceData {
  version: 3;
  people: AppData['people'];
  groups: AppData['groups'];
  tasks: Array<Partial<Task> & Pick<Task, 'id' | 'title' | 'dueDate' | 'status' | 'priority' | 'kind' | 'assigneeIds' | 'requirements'>>;
  templates: AppData['templates'];
}

export function readCloudSession(): string | null { return localStorage.getItem(sessionKey); }
export function saveCloudSession(token: string): void { localStorage.setItem(sessionKey, token); }
export function clearCloudSession(): void { localStorage.removeItem(sessionKey); }
export function readWorkspaceId(): string | null { return localStorage.getItem(workspaceKey); }
export function saveWorkspaceId(id: string): void { localStorage.setItem(workspaceKey, id); }

const noWorkspaceHeader = new Set(['/auth/config', '/auth/google', '/auth/me', '/auth/logout', '/auth/account', '/api/workspaces', '/api/workspaces', '/api/invites/accept']);
export async function cloudRequest<T>(path: string, token?: string, init: RequestInit = {}, workspaceId = readWorkspaceId()): Promise<T> {
  if (!cloudApiBase) throw new Error('Cloud mode is not configured in this build.');
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (path.startsWith('/api/') && !noWorkspaceHeader.has(path)) {
    if (workspaceId) headers.set('X-Workspace-Id', workspaceId);
  }
  const response = await fetch(`${cloudApiBase}${path}`, { ...init, headers, cache: 'no-store' });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || `Cloud request failed (${response.status}).`);
  return result;
}

function cloudTask(task: Task): Record<string, unknown> {
  const { id, title, description, dueDate, dueTime, status, priority, kind, requirements, subtasks, recurrence, recurrenceIntervalDays, assigneeIds, reminderSettings, notes, assignedBy, assignedAt, askedDate, remindBy } = task;
  return { id, title, description, dueDate, dueTime, status, priority, kind, requirements, subtasks, recurrence, recurrenceIntervalDays, assigneeIds, reminderSettings, notes, assignedBy, assignedAt, askedDate, remindBy, createdByUserId: (task as Task & { createdByUserId?: string }).createdByUserId, version: (task as Task & { version?: number }).version };
}
export function exportWorkspaceData(state: AppData): WorkspaceData {
  return {
    version: 3,
    people: state.people.map(({ id, fullName, role, email, isActive }) => ({ id, fullName, role, email, isActive })),
    groups: state.groups,
    tasks: state.tasks.map(task => cloudTask(task) as WorkspaceData['tasks'][number]),
    templates: state.templates,
  };
}
export function applyCloudData(data: Partial<WorkspaceData>, local: AppData): AppData {
  const localTasks = new Map(local.tasks.map(task => [task.id, task]));
  const tasks = (data.tasks ?? []).map(raw => {
    const previous = localTasks.get(raw.id);
    return {
      ...previous,
      ...raw,
      areaId: previous?.areaId ?? 'personal',
      notes: raw.notes ?? previous?.notes ?? '',
      description: raw.description ?? '',
      subtasks: raw.subtasks ?? [],
      reminderSettings: raw.reminderSettings ?? { sendOnAssignment: false, onDueDate: false },
      assignedBy: raw.assignedBy ?? 'Workspace member',
      assignedAt: raw.assignedAt ?? new Date(0).toISOString(),
      remindedCount: previous?.remindedCount ?? 0,
    } as Task;
  });
  return { ...local, tasks, people: data.people ?? [], groups: data.groups ?? [], templates: data.templates ?? [], sampleData: false };
}

export type SyncCollection = 'people' | 'groups' | 'tasks' | 'templates';
export const collectionStateKey: Record<SyncCollection, keyof WorkspaceData> = { people: 'people', groups: 'groups', tasks: 'tasks', templates: 'templates' };
export function collectionPath(collection: SyncCollection, id: string): string { return `/api/${collection}/${encodeURIComponent(id)}`; }
const pendingKey = (workspaceId: string) => `workflow-cloud-pending:${workspaceId}`;
const baselineKey = (workspaceId: string) => `workflow-cloud-baseline:${workspaceId}`;
export interface PendingCloudSync { baseline: Partial<WorkspaceData>; current: Partial<WorkspaceData> }
export function readPendingCloudSync(workspaceId: string): PendingCloudSync | null {
  try { const value = localStorage.getItem(pendingKey(workspaceId)); return value ? JSON.parse(value) as PendingCloudSync : null; } catch { return null; }
}
export function savePendingCloudSync(workspaceId: string, value: PendingCloudSync): void { localStorage.setItem(pendingKey(workspaceId), JSON.stringify(value)); }
export function clearPendingCloudSync(workspaceId: string): void { localStorage.removeItem(pendingKey(workspaceId)); }
export function readCloudBaseline(workspaceId: string): Partial<WorkspaceData> | null {
  try { const value = localStorage.getItem(baselineKey(workspaceId)); return value ? JSON.parse(value) as Partial<WorkspaceData> : null; } catch { return null; }
}
export function saveCloudBaseline(workspaceId: string, value: Partial<WorkspaceData>): void { localStorage.setItem(baselineKey(workspaceId), JSON.stringify(value)); }
export function clearCloudCache(workspaceId: string): void { clearPendingCloudSync(workspaceId); localStorage.removeItem(baselineKey(workspaceId)); }
export function mergePendingCloudData(remote: Partial<WorkspaceData>, baseline: Partial<WorkspaceData>, current: Partial<WorkspaceData>): Partial<WorkspaceData> {
  const merged = { ...remote } as Partial<WorkspaceData>;
  for (const collection of Object.keys(collectionStateKey) as SyncCollection[]) {
    const key = collectionStateKey[collection];
    const before = (baseline[key] ?? []) as Array<{ id: string }>;
    const offline = (current[key] ?? []) as Array<{ id: string }>;
    const latest = (remote[key] ?? []) as Array<{ id: string }>;
    const beforeById = new Map(before.map(item => [item.id, item]));
    const offlineById = new Map(offline.map(item => [item.id, item]));
    const latestById = new Map(latest.map(item => [item.id, item]));
    for (const previous of before) {
      const local = offlineById.get(previous.id);
      if (!local) latestById.delete(previous.id);
      else if (JSON.stringify(local) !== JSON.stringify(previous)) latestById.set(local.id, local);
    }
    for (const local of offline) if (!beforeById.has(local.id)) latestById.set(local.id, local);
    (merged as Record<string, unknown>)[key] = [...latestById.values()];
  }
  return merged;
}
