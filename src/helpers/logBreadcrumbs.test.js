import { describe, it, expect, vi } from 'vitest';
import { addBreadcrumb } from '@sentry/vue';
import { createAuthBreadcrumb, logNavBreadcrumb, useSentryLogging } from './logBreadcrumbs';
const { logBreadcrumb } = useSentryLogging();
vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('logBreadcrumbs', () => {
  it('should log a breadcrumb', () => {
    logBreadcrumb('User is found', {
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
    const logAuthBreadcrumb = createAuthBreadcrumb({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthBreadcrumb('User is found with invalid userType, retrying...', { level: 'warning' });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'warning',
      message: 'User is found with invalid userType, retrying...',
    });
    expect(addBreadcrumb.mock.calls[0][0].data).not.toHaveProperty('details');
  });

  it('should create and log an auth breadcrumb with extra details', () => {
    const logAuthBreadcrumb = createAuthBreadcrumb({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthBreadcrumb('Arrived at CleverLanding.vue', { details: { authFromClever: true } });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever', details: { authFromClever: true } },
      level: 'info',
      message: 'Arrived at CleverLanding.vue',
    });
  });

  it('should log a navigation breadcrumb', () => {
    logNavBreadcrumb('Arrived at CleverLanding.vue', {
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
