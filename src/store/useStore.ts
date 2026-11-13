import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { addDays, addMonths, format } from 'date-fns';
import type { AppData, Area, Event, Group, MessageTemplate, NotificationLogEntry, Person, Section, Task, TaskTemplate } from '../types';
import { defaultMessageTemplate } from '../lib/notifications/templates';
import { migrateAppDataV1, removeSampleContent } from '../lib/data/migrate';

const seed: AppData = {
  version: 3,
  theme: 'light',
  sampleData: false,
  areas: [],
  sections: [],
  events: [],
  tasks: [],
  templates: [],
  people: [],
  groups: [],
  messageTemplates: [defaultMessageTemplate],
  notificationLogs: [],
  notificationLogRetentionDays: 90,
};

interface Store extends AppData {
  addTask: (task: Task) => void;
  toggleTask: (id: string) => void;
  addEvent: (event: Event) => void;
  deleteTask: (id: string) => void;
  deleteEvent: (id: string) => void;
  addArea: (area: Area) => void;
  renameArea: (id: string, name: string, color: string) => void;
  deleteArea: (id: string) => void;
  addSection: (section: Section) => void;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  addTemplate: (template: TaskTemplate) => void;
  deleteTemplate: (id: string) => void;
  updateEvent: (event: Event) => void;
  updateTask: (task: Task) => void;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (id: string) => void;
  addMessageTemplate: (template: MessageTemplate) => void;
  updateMessageTemplate: (template: MessageTemplate) => void;
  deleteMessageTemplate: (id: string) => void;
  logManualNotification: (entry: NotificationLogEntry) => void;
  setNotificationLogRetentionDays: (days: number) => void;
  pruneNotificationLogs: () => void;
  setTheme: (theme: AppData['theme']) => void;
  setBackup: () => void;
  importData: (data: unknown) => void;
  clearSamples: () => void;
  clearAll: () => void;
}

export const useStore = create<Store>()(persist((set) => ({
  ...seed,
  addTask: task => set(s => ({ tasks: [task, ...s.tasks] })),
  toggleTask: id => set(s => {
    const task = s.tasks.find(item => item.id === id);
    if (!task) return s;
    const completing = task.status !== 'done';
    const next = { ...task, status: completing ? 'done' as const : 'todo' as const };
    if (!completing || !task.recurrence) return { tasks: s.tasks.map(item => item.id === id ? next : item) };
    const current = new Date(`${task.dueDate.slice(0, 10)}T12:00:00`);
    const nextDate = task.recurrence === 'daily' ? addDays(current, 1) : task.recurrence === 'weekly' ? addDays(current, 7) : task.recurrence === 'fortnightly' ? addDays(current, 14) : task.recurrence === 'custom' ? addDays(current, task.recurrenceIntervalDays ?? 7) : addMonths(current, 1);
    const repeated = { ...task, id: crypto.randomUUID(), dueDate: format(nextDate, 'yyyy-MM-dd'), status: 'todo' as const, requirements: task.requirements.map(item => ({ ...item, id: crypto.randomUUID(), done: false })), subtasks: task.subtasks.map(item => ({ ...item, id: crypto.randomUUID(), done: false })), remindedCount: 0, lastReminded: undefined, assignedAt: new Date().toISOString() };
    return { tasks: [repeated, ...s.tasks.map(item => item.id === id ? next : item)] };
  }),
  addEvent: event => set(s => ({ events: [event, ...s.events] })),
  deleteTask: id => set(s => ({ tasks: s.tasks.filter(task => task.id !== id) })),
  deleteEvent: id => set(s => ({ events: s.events.filter(event => event.id !== id), tasks: s.tasks.filter(task => task.eventId !== id) })),
  addArea: area => set(s => ({ areas: [...s.areas, area] })),
  renameArea: (id, name, color) => set(s => ({ areas: s.areas.map(area => area.id === id ? { ...area, name, color } : area) })),
  deleteArea: id => set(s => ({ areas: s.areas.filter(area => area.id !== id), sections: s.sections.filter(section => section.areaId !== id), events: s.events.filter(event => event.areaId !== id), tasks: s.tasks.filter(task => task.areaId !== id) })),
  addSection: section => set(s => ({ sections: [...s.sections, section] })),
  renameSection: (id, name) => set(s => ({ sections: s.sections.map(section => section.id === id ? { ...section, name } : section) })),
  deleteSection: id => set(s => ({ sections: s.sections.filter(section => section.id !== id), events: s.events.map(event => event.sectionId === id ? { ...event, sectionId: undefined } : event), tasks: s.tasks.map(task => task.sectionId === id ? { ...task, sectionId: undefined } : task) })),
  addTemplate: template => set(s => ({ templates: [...s.templates, template] })),
  deleteTemplate: id => set(s => ({ templates: s.templates.filter(template => template.id !== id) })),
  updateEvent: event => set(s => ({ events: s.events.map(item => item.id === event.id ? event : item) })),
  updateTask: task => set(s => ({ tasks: s.tasks.map(item => item.id === task.id ? task : item) })),
  addPerson: person => set(s => ({ people: [...s.people, person] })),
  updatePerson: person => set(s => ({ people: s.people.map(item => item.id === person.id ? person : item) })),
  deletePerson: id => set(s => ({ people: s.people.filter(person => person.id !== id), groups: s.groups.map(group => ({ ...group, personIds: group.personIds.filter(personId => personId !== id) })), tasks: s.tasks.map(task => ({ ...task, assigneeIds: task.assigneeIds.filter(personId => personId !== id) })) })),
  addGroup: group => set(s => ({ groups: [...s.groups, group] })),
  updateGroup: group => set(s => ({ groups: s.groups.map(item => item.id === group.id ? group : item) })),
  deleteGroup: id => set(s => ({ groups: s.groups.filter(group => group.id !== id) })),
  addMessageTemplate: template => set(s => ({ messageTemplates: [...s.messageTemplates, template] })),
  updateMessageTemplate: template => set(s => ({ messageTemplates: s.messageTemplates.map(item => item.id === template.id ? template : item) })),
  deleteMessageTemplate: id => set(s => ({ messageTemplates: s.messageTemplates.filter(template => template.id !== id) })),
  logManualNotification: entry => set(s => { const cutoff = Date.now() - s.notificationLogRetentionDays * 86_400_000; return { notificationLogs: [entry, ...s.notificationLogs.filter(log => Date.parse(log.sentAt) >= cutoff)], tasks: s.tasks.map(task => task.id === entry.taskId ? { ...task, remindedCount: task.remindedCount + 1, lastReminded: entry.sentAt } : task) }; }),
  setNotificationLogRetentionDays: days => set(s => { const cutoff = Date.now() - days * 86_400_000; return { notificationLogRetentionDays: days, notificationLogs: s.notificationLogs.filter(log => Date.parse(log.sentAt) >= cutoff) }; }),
  pruneNotificationLogs: () => set(s => { const cutoff = Date.now() - s.notificationLogRetentionDays * 86_400_000; return { notificationLogs: s.notificationLogs.filter(log => Date.parse(log.sentAt) >= cutoff) }; }),
  setTheme: theme => set({ theme }),
  setBackup: () => set({ lastBackup: new Date().toISOString() }),
  importData: data => set(migrateAppDataV1(data, seed)),
  clearSamples: () => set(s => removeSampleContent(s)),
  clearAll: () => set({ ...seed, events: [], tasks: [], people: [], groups: [], notificationLogs: [], sampleData: false }),
}), {
  name: 'workflow-data',
  version: 5,
  storage: createJSONStorage(() => localStorage),
  migrate: (persisted) => removeSampleContent(migrateAppDataV1(persisted, seed)),
}));
