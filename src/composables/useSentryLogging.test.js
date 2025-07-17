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
    logAuthEvent('Arrived at CleverLanding.vue', { data: { provider: 'Clever' } });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'Arrived at CleverLanding.vue',
      data: { provider: 'Clever' },
      level: 'info',
    });
  });

  it('should log a navigation breadcrumb', () => {
    logNavEvent('Arrived at CleverLanding.vue', {
      data: { roarUid: 'testRoarUid', authFrom: 'Clever', authValue: true },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'navigation',
      message: 'Arrived at CleverLanding.vue',
      data: { roarUid: 'testRoarUid', authFrom: 'Clever', authValue: true },
      level: 'info',
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
