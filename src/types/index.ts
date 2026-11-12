export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type Recurrence = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'custom';
export interface Area { id: string; name: string; color: string; icon: string; }
export interface Section { id: string; areaId: string; name: string; }
export interface ChecklistItem { id: string; title: string; done: boolean; }
export interface Task { id: string; title: string; dueDate: string; status: TaskStatus; priority: Priority; notes: string; eventId?: string; areaId: string; sectionId?: string; kind: 'mine' | 'delegated'; subtasks: ChecklistItem[]; recurrence?: Recurrence; recurrenceIntervalDays?: number; assignee?: string; askedDate?: string; remindBy?: string; remindedCount: number; lastReminded?: string; }
export interface Event { id: string; title: string; date: string; endDate?: string; areaId: string; sectionId?: string; location: string; notes: string; status: 'upcoming' | 'complete'; pinned?: boolean; appreciation?: Record<string, string>; }
export interface TaskTemplate { id: string; name: string; tasks: string[]; }
export interface AppData { version: number; areas: Area[]; sections: Section[]; events: Event[]; tasks: Task[]; templates: TaskTemplate[]; theme: 'light' | 'dark' | 'auto'; lastBackup?: string; sampleData: boolean; }
