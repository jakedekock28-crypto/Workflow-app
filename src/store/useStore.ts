import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { addDays, addMonths, format, formatISO } from 'date-fns';
import type { AppData, Area, Event, Group, MessageTemplate, NotificationLogEntry, Person, Section, Task, TaskTemplate } from '../types';
import { defaultMessageTemplate } from '../lib/notifications/templates';
import { migrateAppDataV1 } from '../lib/data/migrate';

const day = (offset: number) => formatISO(addDays(new Date(), offset), { representation: 'date' });
const samplePerson: Person = { id: 'sample-alex', fullName: 'Alex', preferredContact: 'email', notes: 'Example contact — edit or remove.', isActive: true, smsConsent: false };

const seed: AppData = {
  version: 2,
  theme: 'light',
  sampleData: true,
  areas: [{ id: 'cadets', name: 'Cadets', color: '#3c8b70', icon: '✳' }, { id: 'school', name: 'School', color: '#5982c0', icon: '⌁' }, { id: 'personal', name: 'Personal', color: '#9b75ba', icon: '◌' }],
  sections: [{ id: 'biv1', areaId: 'cadets', name: 'Biv 1 · Engineering Bridge' }, { id: 'biv2', areaId: 'cadets', name: 'Biv 2 · Sector Veer' }, { id: 'biv3', areaId: 'cadets', name: 'Biv 3' }, { id: 'biv4', areaId: 'cadets', name: 'Biv 4 · Sector A' }, { id: 'nco', areaId: 'cadets', name: 'NCO WKND 2 · Castle Mountain' }, { id: 'maths', areaId: 'school', name: 'Maths Advanced' }, { id: 'english', areaId: 'school', name: 'English' }, { id: 'science', areaId: 'school', name: 'Science' }],
  events: [{ id: 'ev-biv', title: 'Biv 1 · Engineering Bridge', date: day(3), areaId: 'cadets', sectionId: 'biv1', location: 'Training area', notes: 'Weekend field exercise with the team.', status: 'upcoming', pinned: true }, { id: 'ev-maths', title: 'Functions assessment', date: day(5), areaId: 'school', sectionId: 'maths', location: 'Room 12', notes: '', status: 'upcoming' }, { id: 'ev-hike', title: 'Sunday trail walk', date: day(9), areaId: 'personal', location: 'Riverside track', notes: '', status: 'upcoming' }],
  tasks: [
    { id: 't1', title: 'Confirm the staff plan', description: '', dueDate: day(0), status: 'todo', priority: 'high', notes: '', eventId: 'ev-biv', areaId: 'cadets', sectionId: 'biv1', kind: 'mine', requirements: [], subtasks: [], assigneeIds: [], reminderSettings: { sendOnAssignment: false, onDueDate: false }, assignedBy: 'Workflow user', assignedAt: new Date().toISOString(), remindedCount: 0 },
    { id: 't2', title: 'Finish practice questions', description: '', dueDate: day(1), status: 'doing', priority: 'medium', notes: '', areaId: 'school', sectionId: 'maths', kind: 'mine', requirements: [], subtasks: [], assigneeIds: [], reminderSettings: { sendOnAssignment: false, onDueDate: false }, assignedBy: 'Workflow user', assignedAt: new Date().toISOString(), remindedCount: 0 },
    { id: 't3', title: 'Pack first aid kit', description: '', dueDate: day(2), status: 'todo', priority: 'medium', notes: '', eventId: 'ev-biv', areaId: 'cadets', sectionId: 'biv1', kind: 'mine', requirements: [], subtasks: [], assigneeIds: [], reminderSettings: { sendOnAssignment: false, onDueDate: false }, assignedBy: 'Workflow user', assignedAt: new Date().toISOString(), remindedCount: 0 },
    { id: 't4', title: 'Share the route plan', description: 'Share the agreed route with the team.', dueDate: day(1), status: 'todo', priority: 'high', notes: '', eventId: 'ev-biv', areaId: 'cadets', sectionId: 'biv1', kind: 'delegated', requirements: [{ id: 'req1', title: 'Include the meeting point', done: false }], subtasks: [], assigneeIds: [samplePerson.id], reminderSettings: { sendOnAssignment: false, beforeDue: { amount: 1, unit: 'days' }, onDueDate: true }, assignedBy: 'Workflow user', assignedAt: new Date().toISOString(), remindedCount: 0 },
  ],
  templates: [{ id: 'biv-checklist', name: 'Biv checklist', tasks: ['Write activity appreciation', 'Confirm staff', 'Brief recruits', 'Check equipment', 'First aid check', 'Remind command team'] }],
  people: [samplePerson],
  groups: [],
  messageTemplates: [defaultMessageTemplate],
  notificationLogs: [],
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
  logManualNotification: entry => set(s => ({ notificationLogs: [entry, ...s.notificationLogs], tasks: s.tasks.map(task => task.id === entry.taskId ? { ...task, remindedCount: task.remindedCount + 1, lastReminded: entry.sentAt } : task) })),
  setTheme: theme => set({ theme }),
  setBackup: () => set({ lastBackup: new Date().toISOString() }),
  importData: data => set(migrateAppDataV1(data, seed)),
  clearSamples: () => set(s => ({ events: s.events.filter(event => !event.id.startsWith('ev-')), tasks: s.tasks.filter(task => !['t1', 't2', 't3', 't4'].includes(task.id)), people: s.people.filter(person => person.id !== samplePerson.id), sampleData: false })),
  clearAll: () => set({ ...seed, events: [], tasks: [], people: [], groups: [], notificationLogs: [], sampleData: false }),
}), {
  name: 'workflow-data',
  version: 2,
  storage: createJSONStorage(() => localStorage),
  migrate: (persisted) => migrateAppDataV1(persisted, seed),
}));
