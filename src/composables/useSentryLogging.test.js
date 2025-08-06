import { describe, it, expect, vi } from 'vitest';
import { addBreadcrumb } from '@sentry/vue';
import useSentryLogging from './useSentryLogging';

const { logEvent, logNavEvent, logMediaEvent, logAuthEvent } = useSentryLogging();

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('useSentryLogging', () => {
  it('should log a breadcrumb', () => {
    logEvent('auth', 'User is found', {
      data: { grade: '1' },
      level: 'info',
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'User is found',
      data: { grade: '1' },
      level: 'info',
    });
  });

  it('should log an auth breadcrumb', () => {
    logAuthEvent('No SSO provider detected. Redirecting to SSO landing page...', {
      level: 'warning',
      data: { ssoProvider: 'Clever' },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'No SSO provider detected. Redirecting to SSO landing page...',
      data: { ssoProvider: 'Clever' },
      level: 'warning',
    });
  });

  it('should log a navigation breadcrumb', () => {
    logNavEvent('User does not have permission to access route', {
      level: 'warning',
      data: { permission: 'testPermission', route: 'testRoute' },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'navigation',
      message: 'User does not have permission to access route',
      data: { permission: 'testPermission', route: 'testRoute' },
      level: 'warning',
    });
  });

  it('should log a media breadcrumb', () => {
    logMediaEvent('Video started', { data: { taskId: 'testTaskId' } });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'media',
      message: 'Video started',
      data: { taskId: 'testTaskId' },
      level: 'info',
    });
  });
});
