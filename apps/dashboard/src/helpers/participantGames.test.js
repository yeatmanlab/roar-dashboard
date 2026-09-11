import { describe, it, expect } from 'vitest';
import { mapAdministrationTasksToGames, gameNeedsOrgMemberships } from './participantGames';

const TASK_SWR = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'swr',
  name: 'SWR',
  taskConfig: { taskURL: 'https://example.com/swr', meta: { foo: 'bar' } },
};
const TASK_PA = {
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'pa',
  name: 'PA',
  taskConfig: { external: true, taskURL: 'https://example.com/pa' },
};
const CATALOG = [TASK_SWR, TASK_PA];

const makeTask = (overrides = {}) => ({
  taskId: TASK_SWR.id,
  taskName: 'SWR',
  variantId: 'variant-1',
  variantName: 'Variant 1',
  orderIndex: 0,
  assigned: true,
  optional: false,
  progress: { startedOn: null, completedOn: null, allowRetake: false },
  ...overrides,
});

describe('gameNeedsOrgMemberships', () => {
  const externalGame = (taskId, urlField = 'taskURL') => ({
    taskId,
    taskData: { [urlField]: 'https://example.com/launch' },
  });

  it('returns true for a generic external task (taskURL)', () => {
    expect(gameNeedsOrgMemberships(externalGame('swr'))).toBe(true);
  });

  it('returns true for a generic external task (variantURL)', () => {
    expect(gameNeedsOrgMemberships(externalGame('swr', 'variantURL'))).toBe(true);
  });

  it('returns false for a qualtrics external task (needs only assessmentPid)', () => {
    expect(gameNeedsOrgMemberships(externalGame('survey-qualtrics'))).toBe(false);
  });

  it('returns false for a mefs external task (needs only age, derived from dob)', () => {
    expect(gameNeedsOrgMemberships(externalGame('mefs'))).toBe(false);
  });

  it('returns false for an internal task with no external URL', () => {
    expect(gameNeedsOrgMemberships({ taskId: 'swr', taskData: {} })).toBe(false);
  });

  it('returns false for a nullish or shapeless game', () => {
    expect(gameNeedsOrgMemberships(undefined)).toBe(false);
    expect(gameNeedsOrgMemberships({})).toBe(false);
  });
});

describe('mapAdministrationTasksToGames', () => {
  it('returns an empty array when the administration is null/undefined', () => {
    expect(mapAdministrationTasksToGames(null, CATALOG)).toEqual([]);
    expect(mapAdministrationTasksToGames(undefined, CATALOG)).toEqual([]);
  });

  it('returns an empty array when the administration has no tasks', () => {
    expect(mapAdministrationTasksToGames({ id: 'a' }, CATALOG)).toEqual([]);
  });

  it('filters out tasks that are not assigned to the student', () => {
    const administration = {
      tasks: [makeTask({ taskId: TASK_SWR.id, assigned: true }), makeTask({ taskId: TASK_PA.id, assigned: false })],
    };

    const games = mapAdministrationTasksToGames(administration, CATALOG);

    expect(games).toHaveLength(1);
    expect(games[0].taskId).toBe('swr');
  });

  it('exposes the catalog slug as the game taskId so GameTabs routing works', () => {
    const administration = { tasks: [makeTask({ taskId: TASK_PA.id })] };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    // Game taskId is the slug, not the API UUID.
    expect(game.taskId).toBe('pa');
  });

  it('falls back to the API UUID when the catalog has no matching task', () => {
    const administration = { tasks: [makeTask({ taskId: 'unknown-uuid' })] };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.taskId).toBe('unknown-uuid');
  });

  it('passes through the per-student optional/assigned flags unchanged', () => {
    const administration = {
      tasks: [makeTask({ taskId: TASK_SWR.id, optional: false }), makeTask({ taskId: TASK_PA.id, optional: true })],
    };

    const games = mapAdministrationTasksToGames(administration, CATALOG);

    expect(games.map((g) => g.optional)).toEqual([false, true]);
    expect(games.every((g) => g.assigned === true)).toBe(true);
  });

  it('maps progress through, normalising null timestamps to undefined', () => {
    const administration = {
      tasks: [
        makeTask({
          taskId: TASK_SWR.id,
          progress: { startedOn: '2026-01-01T00:00:00.000Z', completedOn: null, allowRetake: false },
        }),
      ],
    };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.startedOn).toBe('2026-01-01T00:00:00.000Z');
    // null completedOn becomes undefined so GameTabs' `=== undefined` check holds.
    expect(game.completedOn).toBeUndefined();
  });

  it('surfaces the backend-authoritative allowRetake flag', () => {
    const administration = {
      tasks: [
        makeTask({
          taskId: TASK_SWR.id,
          progress: {
            startedOn: '2026-01-01T00:00:00.000Z',
            completedOn: '2026-01-02T00:00:00.000Z',
            allowRetake: true,
          },
        }),
      ],
    };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.allowRetake).toBe(true);
    expect(game.completedOn).toBe('2026-01-02T00:00:00.000Z');
  });

  it('defaults allowRetake to false and timestamps to undefined when progress is absent', () => {
    const administration = { tasks: [makeTask({ taskId: TASK_SWR.id, progress: undefined })] };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.allowRetake).toBe(false);
    expect(game.startedOn).toBeUndefined();
    expect(game.completedOn).toBeUndefined();
  });

  it('maps catalog presentational fields and taskConfig extras into taskData', () => {
    const administration = { tasks: [makeTask({ taskId: TASK_PA.id })] };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.taskData.name).toBe('PA');
    expect(game.taskData.external).toBe(true);
    expect(game.taskData.taskURL).toBe('https://example.com/pa');
  });

  it('defaults external to false when the catalog task has no external config', () => {
    const administration = { tasks: [makeTask({ taskId: TASK_SWR.id })] };

    const [game] = mapAdministrationTasksToGames(administration, CATALOG);

    expect(game.taskData.external).toBe(false);
    expect(game.taskData.meta).toEqual({ foo: 'bar' });
  });
});
