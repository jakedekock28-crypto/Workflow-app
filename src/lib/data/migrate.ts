import { defaultMessageTemplate } from '../notifications/templates';
import type { AppData, Person, Task, TaskReminderSettings } from '../../types';

export const defaultReminderSettings: TaskReminderSettings = {
  sendOnAssignment: false,
  onDueDate: false,
};

function legacyPersonId(name: string): string {
  const normalized = name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'person';
  const hash = [...normalized].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36);
  return `legacy-${slug}-${hash}`;
}

export function migrateAppDataV1(input: unknown, defaults: AppData): AppData {
  const old = (input && typeof input === 'object' ? input : {}) as Partial<AppData> & { tasks?: Array<Partial<Task> & { assignee?: string }> };
  const peopleByName = new Map<string, Person>();
  const existingPeople = old.people ?? [];
  for (const person of existingPeople) peopleByName.set(person.fullName.trim().toLowerCase(), person);

  for (const task of old.tasks ?? []) {
    const name = task.assignee?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!peopleByName.has(key)) {
      peopleByName.set(key, {
        id: legacyPersonId(name),
        fullName: name,
        preferredContact: 'email',
        notes: '',
        isActive: true,
        smsConsent: false,
        needsReview: true,
      });
    }
  }

  const migratedTasks = (old.tasks ?? defaults.tasks).map((raw) => {
    const task = raw as Partial<Task> & { assignee?: string; subtasks?: Task['subtasks'] };
    const legacyName = task.assignee?.trim();
    const person = legacyName ? peopleByName.get(legacyName.toLowerCase()) : undefined;
    return {
      ...task,
      description: task.description ?? task.notes ?? '',
      dueDate: task.dueDate ?? '',
      status: task.status ?? 'todo',
      priority: task.priority ?? 'medium',
      requirements: task.requirements ?? task.subtasks ?? [],
      subtasks: task.subtasks ?? task.requirements ?? [],
      assigneeIds: task.assigneeIds ?? (person ? [person.id] : []),
      reminderSettings: task.reminderSettings ?? { ...defaultReminderSettings },
      assignedBy: task.assignedBy ?? 'Workflow user',
      assignedAt: task.assignedAt ?? task.askedDate ?? new Date(0).toISOString(),
      remindedCount: task.remindedCount ?? 0,
      kind: task.kind ?? 'mine',
      notes: task.notes ?? '',
    } as Task;
  });

  return {
    ...defaults,
    ...old,
    version: 2,
    tasks: migratedTasks,
    people: [...peopleByName.values()],
    groups: old.groups ?? [],
    messageTemplates: old.messageTemplates?.length ? old.messageTemplates : [defaultMessageTemplate],
    notificationLogs: old.notificationLogs ?? [],
  } as AppData;
}
