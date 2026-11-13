import { describe, expect, it } from 'vitest';
import { migrateAppDataV1 } from '../migrate';
import { defaultMessageTemplate } from '../../notifications/templates';
import type { AppData } from '../../../types';

const defaults: AppData = { version: 3, areas: [], sections: [], events: [], tasks: [], templates: [], people: [], groups: [], messageTemplates: [defaultMessageTemplate], notificationLogs: [], notificationLogRetentionDays: 90, theme: 'light', sampleData: false };

describe('v1 data migration', () => {
  it('keeps existing tasks, migrates legacy assignees, and strips phone and SMS data', () => {
    const migrated = migrateAppDataV1({ version: 2, areas: [], sections: [], events: [], templates: [], tasks: [{ id: 'old', title: 'Call team', dueDate: '2026-12-01', status: 'todo', priority: 'medium', notes: 'Bring details', areaId: 'a', kind: 'delegated', assignee: 'Jordan', reminderChannel: 'sms', subtasks: [{ id: 's', title: 'Prepare', done: false }], remindedCount: 0 }], people: [{ id: 'p1', fullName: 'Jordan', roleOrRank: 'Sergeant', mobileNumber: '+61412345678', preferredContact: 'sms', notes: 'private', smsConsent: true, isActive: true }], messageTemplates: [{ ...defaultMessageTemplate, smsBody: 'SMS message' }], notificationLogs: [{ id: 'l1', taskId: 'old', personId: 'p1', channel: 'sms', sentAt: '2026-01-01', status: 'sent', messagePreview: 'private text' }], theme: 'light', sampleData: false }, defaults);
    expect(migrated.tasks[0].id).toBe('old');
    expect(migrated.tasks[0].description).toBe('Bring details');
    expect(migrated.tasks[0].assigneeIds).toEqual([migrated.people[0].id]);
    expect(migrated.people[0]).toMatchObject({ fullName: 'Jordan', isActive: true });
    expect(migrated.people[0]).not.toHaveProperty('mobileNumber');
    expect(migrated.people[0]).not.toHaveProperty('notes');
    expect(migrated.people[0]).not.toHaveProperty('roleOrRank');
    expect(migrated.tasks[0]).not.toHaveProperty('reminderChannel');
    expect(migrated.messageTemplates[0]).not.toHaveProperty('smsBody');
    expect(migrated.notificationLogs).toHaveLength(0);
    expect(migrated.tasks[0].requirements[0].title).toBe('Prepare');
  });

  it('keeps confirmed email history only within the configured retention window', () => {
    const log = (id: string, daysAgo: number) => ({ id, taskId: 'task', personId: 'person', channel: 'email' as const, sentAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), status: 'sent' as const });
    const migrated = migrateAppDataV1({ version: 3, notificationLogRetentionDays: 30, notificationLogs: [log('recent', 10), log('expired', 60)] }, defaults);
    expect(migrated.notificationLogRetentionDays).toBe(30);
    expect(migrated.notificationLogs.map(item => item.id)).toEqual(['recent']);
  });
});
