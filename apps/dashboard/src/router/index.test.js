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

import { routes } from './index';

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
