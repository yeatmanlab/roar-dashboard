import { describe, it, expect, vi } from 'vitest';
import { addBreadcrumb } from '@sentry/vue';
import useSentryLogging from './logBreadcrumbs';
const { logEvent, createAuthLogger, logNavEvent } = useSentryLogging();
vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('logEvents', () => {
  it('should log a breadcrumb', () => {
    logEvent('User is found', {
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'info',
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'info',
      message: 'User is found',
    });
  });

  it('should create and log an auth breadcrumb without extra details', () => {
    const logAuthEvent = createAuthLogger({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthEvent('User is found with invalid userType, retrying...', { level: 'warning' });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'warning',
      message: 'User is found with invalid userType, retrying...',
    });
    expect(addBreadcrumb.mock.calls[0][0].data).not.toHaveProperty('details');
  });

  it('should create and log an auth breadcrumb with extra details', () => {
    const logAuthEvent = createAuthLogger({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthEvent('Arrived at CleverLanding.vue', { details: { authFromClever: true } });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever', details: { authFromClever: true } },
      level: 'info',
      message: 'Arrived at CleverLanding.vue',
    });
  });

  it('should log a navigation breadcrumb', () => {
    logNavEvent('Arrived at CleverLanding.vue', {
      data: { roarUid: 'testUid', authFrom: 'Clever', authValue: true },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'navigation',
      data: { roarUid: 'testUid', authFrom: 'Clever', authValue: true },
      level: 'info',
      message: 'Arrived at CleverLanding.vue',
    });
  });
});
