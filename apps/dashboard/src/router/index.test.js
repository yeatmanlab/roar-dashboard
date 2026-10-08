import { describe, expect, it, vi } from 'vitest';
import { APP_ROUTES, GAME_ROUTES } from '@/constants/routes';

vi.mock('@/composables/usePermissions', () => ({
  usePermissions: () => ({
    Permissions: {
      Administrations: {
        CREATE: 'administrations.create',
        UPDATE: 'administrations.update',
      },
      Administrators: {
        CREATE: 'administrators.create',
        UPDATE: 'administrators.update',
      },
      Organizations: {
        CREATE: 'organizations.create',
        LIST: 'organizations.list',
      },
      Reports: {
        Progress: { READ: 'reports.progress.read' },
        Score: { READ: 'reports.score.read' },
        Student: { READ: 'reports.student.read' },
      },
      Tasks: {
        LAUNCH: 'tasks.launch',
        UPDATE: 'tasks.update',
      },
      Users: {
        CREATE: 'users.create',
        LIST: 'users.list',
      },
    },
    userCan: vi.fn(),
  }),
}));

vi.mock('@/composables/useSentryLogging', () => ({
  default: () => ({ logNavEvent: vi.fn() }),
}));

vi.mock('@/composables/queries/useMeQuery', () => ({
  fetchMe: vi.fn(),
}));

import { isUnauthenticatedRouteAllowed, routes } from './index';

describe('router launch routes', () => {
  it('defines a proxy-launch route for every game route', () => {
    const routePaths = new Set(routes.map((route) => route.path));

    for (const gameRoute of Object.values(GAME_ROUTES)) {
      expect(routePaths).toContain(`${APP_ROUTES.LAUNCH}${gameRoute}`);
    }
  });

  it('passes launchId props through each proxy-launch game route', () => {
    const launchRoutes = routes.filter((route) => route.path.startsWith(`${APP_ROUTES.LAUNCH}/game/`));

    for (const route of launchRoutes) {
      expect(route.meta?.permission).toBe('tasks.launch');
      expect(route.props({ params: { launchId: 'child-user-uuid', taskId: 'matrix-reasoning' } }).launchId).toBe(
        'child-user-uuid',
      );
    }
  });
});

describe('router unauthenticated routes', () => {
  it('allows the account-owner registration route without authentication', () => {
    const registrationRoute = routes.find((route) => route.path === APP_ROUTES.REGISTER);

    expect(registrationRoute).toBeDefined();
    expect(isUnauthenticatedRouteAllowed(registrationRoute)).toBe(true);
  });

  it('does not allow a protected route without authentication', () => {
    expect(isUnauthenticatedRouteAllowed({ name: 'Protected', meta: {} })).toBe(false);
  });
});
