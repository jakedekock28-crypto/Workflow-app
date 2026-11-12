import { describe, expect, it } from 'vitest';
import { migrateAppDataV1 } from '../migrate';
import { defaultMessageTemplate } from '../../notifications/templates';
import type { AppData } from '../../../types';

const defaults: AppData = { version: 2, areas: [], sections: [], events: [], tasks: [], templates: [], people: [], groups: [], messageTemplates: [defaultMessageTemplate], notificationLogs: [], theme: 'light', sampleData: false };

describe('v1 data migration', () => {
  it('keeps existing tasks and creates reviewable saved contacts for legacy assignees', () => {
    const migrated = migrateAppDataV1({ version: 1, areas: [], sections: [], events: [], templates: [], tasks: [{ id: 'old', title: 'Call team', dueDate: '2026-12-01', status: 'todo', priority: 'medium', notes: 'Bring details', areaId: 'a', kind: 'delegated', assignee: 'Jordan', subtasks: [{ id: 's', title: 'Prepare', done: false }], remindedCount: 0 }], theme: 'light', sampleData: false }, defaults);
    expect(migrated.tasks[0].id).toBe('old');
    expect(migrated.tasks[0].description).toBe('Bring details');
    expect(migrated.tasks[0].assigneeIds).toEqual([migrated.people[0].id]);
    expect(migrated.people[0]).toMatchObject({ fullName: 'Jordan', needsReview: true, smsConsent: false });
    expect(migrated.tasks[0].requirements[0].title).toBe('Prepare');
  });
});
