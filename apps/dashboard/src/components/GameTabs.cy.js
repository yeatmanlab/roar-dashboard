import { createTestingPinia } from '@pinia/testing';
import GameTabs from './GameTabs.vue';

/**
 * Build a game object in the shape `GameTabs` consumes after the ts-rest
 * migration: per-student `optional`/`assigned`/`progress` are flattened onto
 * the game, and `allowRetake` is authoritative from the backend.
 */
const makeGame = (overrides = {}) => ({
  taskId: 'swr',
  optional: false,
  assigned: true,
  startedOn: undefined,
  completedOn: undefined,
  allowRetake: false,
  taskData: {
    name: 'Word Reading',
    description: 'A word reading task.',
    external: false,
    taskURL: undefined,
    meta: undefined,
  },
  ...overrides,
});

const MOCK_USER_DATA = {
  id: 'student-1',
  // Grade > 3 so the tutorial video branch (which mounts VideoPlayer) is skipped.
  studentData: { grade: 5 },
};

const mountGameTabs = (games) => {
  cy.mount(GameTabs, {
    props: {
      games,
      sequential: false,
      userData: MOCK_USER_DATA,
    },
    global: {
      plugins: [createTestingPinia({ createSpy: cy.spy })],
    },
  });
};

describe('<GameTabs />', () => {
  it('shows the retake-required status for a completed task when allowRetake is true', () => {
    mountGameTabs([
      makeGame({
        taskId: 'swr',
        startedOn: '2026-01-01T00:00:00.000Z',
        completedOn: '2026-01-02T00:00:00.000Z',
        allowRetake: true,
      }),
    ]);

    cy.get('[data-game-status="retake-required"]').should('exist');
    cy.get('[data-game-status="complete"]').should('not.exist');
  });

  it('shows the complete status for a completed task when allowRetake is false', () => {
    mountGameTabs([
      makeGame({
        taskId: 'swr',
        startedOn: '2026-01-01T00:00:00.000Z',
        completedOn: '2026-01-02T00:00:00.000Z',
        allowRetake: false,
      }),
    ]);

    cy.get('[data-game-status="complete"]').should('exist');
    cy.get('[data-game-status="retake-required"]').should('not.exist');
  });

  it('keys the retake gate off allowRetake only, regardless of taskId', () => {
    // A task that previously lived on the retake-exclusion list (e.g. 'ran').
    // Post-migration the exclusion list is gone, so a completed `ran` with
    // allowRetake: true must still surface the retake-required status.
    mountGameTabs([
      makeGame({
        taskId: 'ran',
        startedOn: '2026-01-01T00:00:00.000Z',
        completedOn: '2026-01-02T00:00:00.000Z',
        allowRetake: true,
        taskData: { name: 'RAN', description: 'Rapid naming.', external: false },
      }),
    ]);

    cy.get('[data-game-status="retake-required"]').should('exist');
    cy.get('[data-game-status="complete"]').should('not.exist');
  });
});
