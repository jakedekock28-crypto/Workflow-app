import { defaultMessageTemplate } from '../notifications/templates';
import type { AppData, Person, Task, TaskReminderSettings } from '../../types';

export const defaultReminderSettings: TaskReminderSettings = {
  sendOnAssignment: false,
  onDueDate: false,
};

const sampleAreas = new Map([['cadets', 'Cadets'], ['school', 'School'], ['personal', 'Personal']]);
const sampleSections = new Map([
  ['biv1', 'Biv 1 · Engineering Bridge'], ['biv2', 'Biv 2 · Sector Veer'], ['biv3', 'Biv 3'],
  ['biv4', 'Biv 4 · Sector A'], ['nco', 'NCO WKND 2 · Castle Mountain'],
  ['maths', 'Maths Advanced'], ['english', 'English'], ['science', 'Science'],
]);
const sampleEvents = new Map([
  ['ev-biv', 'Biv 1 · Engineering Bridge'], ['ev-maths', 'Functions assessment'], ['ev-hike', 'Sunday trail walk'],
]);
const sampleTasks = new Map([
  ['t1', 'Confirm the staff plan'], ['t2', 'Finish practice questions'],
  ['t3', 'Pack first aid kit'], ['t4', 'Share the route plan'],
]);
const sampleChecklist = ['Write activity appreciation', 'Confirm staff', 'Brief recruits', 'Check equipment', 'First aid check', 'Remind command team'];

/** Remove only the built-in demo records, keeping user-created and edited records. */
export function removeSampleContent(data: AppData): AppData {
  const events = data.events.filter(event => sampleEvents.get(event.id) !== event.title);
  const tasks = data.tasks.filter(task => sampleTasks.get(task.id) !== task.title);
  const usedSectionIds = new Set([
    ...events.map(event => event.sectionId),
    ...tasks.map(task => task.sectionId),
  ].filter((id): id is string => Boolean(id)));
  const sections = data.sections.filter(section => sampleSections.get(section.id) !== section.name || usedSectionIds.has(section.id));
  const usedAreaIds = new Set([
    ...events.map(event => event.areaId),
    ...tasks.map(task => task.areaId),
    ...sections.map(section => section.areaId),
  ]);
  const areas = data.areas.filter(area => sampleAreas.get(area.id) !== area.name || usedAreaIds.has(area.id));
  const usedPersonIds = new Set([...tasks.flatMap(task => task.assigneeIds), ...data.groups.flatMap(group => group.personIds)]);
  const people = data.people.filter(person => person.id !== 'sample-alex' || person.fullName !== 'Alex' || usedPersonIds.has(person.id));
  const templates = data.templates.filter(template => template.id !== 'biv-checklist' || template.name !== 'Biv checklist' || JSON.stringify(template.tasks) !== JSON.stringify(sampleChecklist));

  return { ...data, areas, sections, events, tasks, people, templates, sampleData: false };
}

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
        isActive: true,
      });
    }
  }

  const migratedTasks = (old.tasks ?? defaults.tasks).map((raw) => {
    const task = raw as Partial<Task> & { assignee?: string; subtasks?: Task['subtasks'] };
    const legacyName = task.assignee?.trim();
    const person = legacyName ? peopleByName.get(legacyName.toLowerCase()) : undefined;
    const cleanTask = { ...task } as Record<string, unknown>;
    delete cleanTask.reminderChannel;
    return {
      ...cleanTask,
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
    version: 3,
    tasks: migratedTasks,
    people: [...peopleByName.values()].map(raw => {
      const clean = { ...raw } as Record<string, unknown>;
      delete clean.mobileNumber; delete clean.preferredContact; delete clean.notes; delete clean.smsConsent; delete clean.needsReview; delete clean.roleOrRank;
      return clean as unknown as Person;
    }),
    groups: old.groups ?? [],
    messageTemplates: old.messageTemplates?.length ? old.messageTemplates.map(raw => { const clean = { ...raw } as Record<string, unknown>; delete clean.smsBody; return clean as unknown as AppData['messageTemplates'][number]; }) : [defaultMessageTemplate],
    notificationLogs: (old.notificationLogs ?? []).filter(item => item.channel === 'email' && item.status === 'sent' && Date.parse(item.sentAt) >= Date.now() - (old.notificationLogRetentionDays ?? defaults.notificationLogRetentionDays) * 86_400_000).map(raw => { const clean = { ...raw } as Record<string, unknown>; delete clean.messagePreview; delete clean.errorMessage; return clean as unknown as AppData['notificationLogs'][number]; }),
    notificationLogRetentionDays: Math.min(365, Math.max(30, old.notificationLogRetentionDays ?? defaults.notificationLogRetentionDays)),
  } as AppData;
}
