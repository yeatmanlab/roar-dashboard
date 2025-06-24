import { describe, it, expect, vi } from 'vitest';
import { logBreadcrumb, createAuthBreadcrumb } from './logBreadcrumb';
import { addBreadcrumb } from '@sentry/vue';

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('logBreadcrumb', () => {
  it('should log a breadcrumb', () => {
    logBreadcrumb({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      message: 'User is found',
      level: 'info',
    });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'info',
      message: 'User is found',
      timestamp: expect.any(Date),
    });
  });

  it('should log an auth breadcrumb without extra details', () => {
    const logAuthBreadcrumb = createAuthBreadcrumb({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthBreadcrumb({ message: 'User is found with invalid userType, retrying...', level: 'warning' });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever' },
      level: 'warning',
      message: 'User is found with invalid userType, retrying...',
      timestamp: expect.any(Date),
    });
    expect(addBreadcrumb.mock.calls[0][0].data).not.toHaveProperty('details');
  });

  it('should log an auth breadcrumb with extra details', () => {
    const logAuthBreadcrumb = createAuthBreadcrumb({ roarUid: 'testUid', userType: 'student', provider: 'Clever' });
    logAuthBreadcrumb({ message: 'Arrived at CleverLanding.vue', details: { authFromClever: true } });
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      data: { roarUid: 'testUid', userType: 'student', provider: 'Clever', details: { authFromClever: true } },
      level: 'info',
      message: 'Arrived at CleverLanding.vue',
      timestamp: expect.any(Date),
    });
  });
});
