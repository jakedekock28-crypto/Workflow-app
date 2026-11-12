import type { AppData } from '../../types';

const sessionKey = 'workflow-cloud-session';
export const cloudApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export interface CloudSession {
  token: string;
  expiresAt: string;
  user: { email: string };
}

export function readCloudSession(): string | null {
  return localStorage.getItem(sessionKey);
}
export function saveCloudSession(token: string): void {
  localStorage.setItem(sessionKey, token);
}
export function clearCloudSession(): void {
  localStorage.removeItem(sessionKey);
}

export async function cloudRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  if (!cloudApiBase) throw new Error('Cloud mode is not configured in this build.');
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${cloudApiBase}${path}`, { ...init, headers, cache: 'no-store' });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || `Cloud request failed (${response.status}).`);
  return result;
}

export function exportLocalData(state: AppData): AppData {
  return {
    version: 2,
    areas: state.areas,
    sections: state.sections,
    events: state.events,
    tasks: state.tasks,
    templates: state.templates,
    people: state.people,
    groups: state.groups,
    messageTemplates: state.messageTemplates,
    notificationLogs: state.notificationLogs,
    theme: state.theme,
    lastBackup: state.lastBackup,
    sampleData: state.sampleData,
  };
}

export function applyCloudData(data: Partial<AppData>, local: AppData): AppData {
  return {
    ...exportLocalData(local),
    ...data,
    version: 2,
    areas: data.areas ?? [],
    sections: data.sections ?? [],
    events: data.events ?? [],
    tasks: data.tasks ?? [],
    templates: data.templates ?? [],
    people: data.people ?? [],
    groups: data.groups ?? [],
    messageTemplates: data.messageTemplates ?? [],
    notificationLogs: data.notificationLogs ?? [],
    sampleData: false,
  };
}

export type SyncCollection = 'areas' | 'sections' | 'events' | 'people' | 'groups' | 'tasks' | 'task-templates' | 'templates' | 'notification-logs';
export const collectionStateKey: Record<SyncCollection, keyof AppData> = {
  areas: 'areas',
  sections: 'sections',
  events: 'events',
  people: 'people',
  groups: 'groups',
  tasks: 'tasks',
  'task-templates': 'templates',
  templates: 'messageTemplates',
  'notification-logs': 'notificationLogs',
};

export function collectionPath(collection: SyncCollection, id: string): string {
  return `/api/${collection}/${encodeURIComponent(id)}`;
}

const pendingSyncKey = 'workflow-cloud-pending-sync';
export interface PendingCloudSync { baseline: Partial<AppData>; current: Partial<AppData> }
export function readPendingCloudSync(): PendingCloudSync | null {
  try {
    const value = localStorage.getItem(pendingSyncKey);
    return value ? JSON.parse(value) as PendingCloudSync : null;
  } catch { return null; }
}
export function savePendingCloudSync(value: PendingCloudSync): void {
  localStorage.setItem(pendingSyncKey, JSON.stringify(value));
}
export function clearPendingCloudSync(): void {
  localStorage.removeItem(pendingSyncKey);
}
export function mergePendingCloudData(remote: Partial<AppData>, baseline: Partial<AppData>, current: Partial<AppData>): Partial<AppData> {
  const merged = { ...remote } as Partial<AppData>;
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
export function readCloudBaseline(): Partial<AppData> | null {
  try { const value = localStorage.getItem('workflow-cloud-baseline'); return value ? JSON.parse(value) as Partial<AppData> : null; } catch { return null; }
}
export function saveCloudBaseline(value: Partial<AppData>): void {
  localStorage.setItem('workflow-cloud-baseline', JSON.stringify(value));
}
export function clearCloudBaseline(): void {
  localStorage.removeItem('workflow-cloud-baseline');
}
