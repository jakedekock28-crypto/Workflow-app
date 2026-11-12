import { describe, expect, it } from 'vitest';
import { formatAustralianPhone, isValidEmail } from '../phone';
import { createMessageValues, defaultMessageTemplate, renderMessage } from '../templates';
import { calculateReminderSchedule } from '../schedule';
import type { Task, Person } from '../../../types';

const person: Person = { id: 'p1', fullName: 'Sam Lee', preferredContact: 'email', notes: '', isActive: true, smsConsent: false };
const task: Task = { id: 't1', title: 'Check equipment', description: 'Inspect the radios', dueDate: '2027-03-10', dueTime: '10:00', status: 'todo', priority: 'high', notes: '', areaId: 'a1', kind: 'delegated', requirements: [{ id: 'r1', title: 'Charge batteries', done: false }], subtasks: [], assigneeIds: [person.id], reminderSettings: { sendOnAssignment: false, beforeDue: { amount: 1, unit: 'days' }, onDueDate: true }, assignedBy: 'Alex', assignedAt: '2027-01-01T00:00:00.000Z', remindedCount: 0 };

describe('Australian contact formatting', () => {
  it('normalises a local mobile to international format', () => expect(formatAustralianPhone('0412 345 678')).toBe('+61412345678'));
  it('accepts an existing international number', () => expect(formatAustralianPhone('+61 412 345 678')).toBe('+61412345678'));
  it('rejects invalid and non-Australian numbers', () => { expect(formatAustralianPhone('123')).toBeNull(); expect(formatAustralianPhone('+1 415 555 2671')).toBeNull(); });
  it('validates email addresses', () => { expect(isValidEmail('person@example.com')).toBe(true); expect(isValidEmail('no-at-sign')).toBe(false); });
});

describe('message templates', () => {
  it('renders all task and person placeholders', () => {
    const message = renderMessage(defaultMessageTemplate, createMessageValues(task, person, 'Alex'));
    expect(message.emailSubject).toBe('Task: Check equipment');
    expect(message.emailBody).toContain('Hi Sam Lee');
    expect(message.emailBody).toContain('Charge batteries');
    expect(message.emailBody).toContain('Alex has assigned');
    expect(message.smsBody).not.toContain('{TaskTitle}');
  });
});

describe('reminder schedule', () => {
  it('calculates before-due and due date reminders in order', () => {
    const slots = calculateReminderSchedule(task, new Date('2027-03-01T00:00:00.000Z'));
    expect(slots.map(slot => slot.trigger)).toEqual(['before-due', 'due']);
    expect(slots[0].scheduledAt).toBe(new Date(2027, 2, 9, 10, 0, 0).toISOString());
  });
  it('schedules assignment and repeated reminders and stops for completed tasks', () => {
    const configured = { ...task, assignedAt: '2027-03-02T00:00:00.000Z', reminderSettings: { sendOnAssignment: true, onDueDate: false, repeat: { amount: 1, unit: 'days' as const } } };
    const slots = calculateReminderSchedule(configured, new Date('2027-03-01T00:00:00.000Z'));
    expect(slots.slice(0, 3).map(slot => slot.trigger)).toEqual(['assignment', 'repeat', 'repeat']);
    expect(slots.length).toBeGreaterThan(300);
    expect(calculateReminderSchedule({ ...configured, status: 'done' }, new Date('2027-03-01T00:00:00.000Z'))).toEqual([]);
  });
});
