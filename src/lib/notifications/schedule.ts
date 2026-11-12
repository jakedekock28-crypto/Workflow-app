import type { Task, ReminderUnit } from '../../types';

export type ReminderTrigger = 'assignment' | 'before-due' | 'due' | 'repeat';
export interface ReminderSlot {
  id: string;
  scheduledAt: string;
  trigger: ReminderTrigger;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function offsetMs(amount: number, unit: ReminderUnit): number {
  return amount * (unit === 'hours' ? HOUR_MS : DAY_MS);
}

function dueTimestamp(task: Task): number | null {
  if (!task.dueDate) return null;
  const time = task.dueTime || '09:00';
  const parsed = new Date(`${task.dueDate.slice(0, 10)}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function calculateReminderSchedule(task: Task, now = new Date()): ReminderSlot[] {
  if (task.status === 'done') return [];
  const nowMs = now.getTime();
  const slots: ReminderSlot[] = [];
  const due = dueTimestamp(task);
  const addSlot = (id: string, at: number, trigger: ReminderTrigger) => {
    if (at >= nowMs && Number.isFinite(at)) slots.push({ id, scheduledAt: new Date(at).toISOString(), trigger });
  };

  if (task.reminderSettings.sendOnAssignment) {
    addSlot('assignment', new Date(task.assignedAt).getTime() || nowMs, 'assignment');
  }
  if (due !== null && task.reminderSettings.beforeDue) {
    addSlot('before-due', due - offsetMs(task.reminderSettings.beforeDue.amount, task.reminderSettings.beforeDue.unit), 'before-due');
  }
  if (due !== null && task.reminderSettings.onDueDate) addSlot('due', due, 'due');
  if (due !== null && task.reminderSettings.repeat) {
    const interval = offsetMs(task.reminderSettings.repeat.amount, task.reminderSettings.repeat.unit);
    if (interval > 0) {
      const horizon = nowMs + 366 * DAY_MS;
      let at = due + interval;
      let count = 0;
      while (at <= horizon && count < 400) {
        addSlot(`repeat-${count + 1}`, at, 'repeat');
        at += interval;
        count += 1;
      }
    }
  }
  return slots.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
