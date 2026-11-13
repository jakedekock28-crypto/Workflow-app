import { describe, expect, it } from 'vitest';
import { mergePendingCloudData } from '../client';
import type { AppData } from '../../../types';

const base: AppData['people'][number] = { id: 'p1', fullName: 'Alex', email: 'alex@example.com', isActive: true };
const updated = { ...base, fullName: 'Alex Lee' };
const remoteOnly = { ...base, id: 'p2', fullName: 'Morgan' };
const empty = { version: 3 as const, people: [], groups: [], tasks: [], templates: [] };

describe('offline cloud reconciliation', () => {
  it('replays local offline edits without dropping newer remote records', () => {
    const result = mergePendingCloudData({ ...empty, people: [base, remoteOnly] }, { ...empty, people: [base] }, { ...empty, people: [updated] });
    expect(result.people).toEqual(expect.arrayContaining([remoteOnly, updated]));
  });

  it('replays local deletions while keeping unrelated remote additions', () => {
    const result = mergePendingCloudData({ ...empty, people: [base, remoteOnly] }, { ...empty, people: [base] }, { ...empty, people: [] });
    expect(result.people).toEqual([remoteOnly]);
  });

  it('keeps remote changes when the local record did not change offline', () => {
    const serverCopy = { ...base, fullName: 'Alex on another device' };
    const result = mergePendingCloudData({ ...empty, people: [serverCopy] }, { ...empty, people: [base] }, { ...empty, people: [base] });
    expect(result.people).toEqual([serverCopy]);
  });
});
