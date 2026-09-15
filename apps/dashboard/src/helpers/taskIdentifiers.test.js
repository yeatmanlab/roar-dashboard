import { describe, it, expect } from 'vitest';
import { findTaskByIdOrSlug, filterTasksByIdOrSlug } from './taskIdentifiers';

const TASK_SWR = { id: '00000000-0000-0000-0000-000000000001', slug: 'swr', name: 'SWR' };
const TASK_PA = { id: '00000000-0000-0000-0000-000000000002', slug: 'pa', name: 'PA' };
const TASKS = [TASK_SWR, TASK_PA];

describe('findTaskByIdOrSlug', () => {
  it('matches by backend UUID', () => {
    expect(findTaskByIdOrSlug(TASKS, TASK_PA.id)).toBe(TASK_PA);
  });

  it('matches by legacy slug', () => {
    expect(findTaskByIdOrSlug(TASKS, 'swr')).toBe(TASK_SWR);
  });

  it('returns undefined when nothing matches', () => {
    expect(findTaskByIdOrSlug(TASKS, 'nonexistent')).toBeUndefined();
  });

  it('tolerates a nullish task catalog', () => {
    expect(findTaskByIdOrSlug(undefined, 'swr')).toBeUndefined();
    expect(findTaskByIdOrSlug(null, 'swr')).toBeUndefined();
  });
});

describe('filterTasksByIdOrSlug', () => {
  it('matches a mix of UUIDs and slugs', () => {
    expect(filterTasksByIdOrSlug(TASKS, [TASK_SWR.id, 'pa'])).toEqual([TASK_SWR, TASK_PA]);
  });

  it('returns an empty array when no identifiers are given', () => {
    expect(filterTasksByIdOrSlug(TASKS, [])).toEqual([]);
    expect(filterTasksByIdOrSlug(TASKS, undefined)).toEqual([]);
  });

  it('returns an empty array for a nullish task catalog', () => {
    expect(filterTasksByIdOrSlug(undefined, ['swr'])).toEqual([]);
  });

  it('excludes tasks that match no identifier', () => {
    expect(filterTasksByIdOrSlug(TASKS, ['pa'])).toEqual([TASK_PA]);
  });
});
