import { describe, it, expect, vi } from 'vitest';
import { addBreadcrumb } from '@sentry/vue';
import useSentryLogging from './useSentryLogging';
const { logEvent, createAuthLogger, logNavEvent, logMediaEvent, logProfileEvent, logAccessEvent } = useSentryLogging();
vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
}));

describe('logEvents', () => {
  const logAuthEvent = createAuthLogger({ roarUid: 'testRoarUid', userType: 'student', provider: 'Clever' });

  it('should log a breadcrumb', () => {
    logEvent('auth', 'User is found', {
      data: { roarUid: 'testRoarUid', userType: 'student', provider: 'Clever' },
      level: 'info',
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'User is found',
      data: { roarUid: 'testRoarUid', userType: 'student', provider: 'Clever' },
      level: 'info',
    });
  });

  it('should log an auth breadcrumb with base data', () => {
    logAuthEvent('Arrived at CleverLanding.vue');

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'Arrived at CleverLanding.vue',
      data: { roarUid: 'testRoarUid', userType: 'student', provider: 'Clever' },
      level: 'info',
    });
  });

  it('should log an auth breadcrumb with only non-detail attributes', () => {
    logAuthEvent('User is found with invalid userType, retrying...', { level: 'warning' });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'User is found with invalid userType, retrying...',
      data: { roarUid: 'testRoarUid', userType: 'student', provider: 'Clever' },
      level: 'warning',
    });
    expect(addBreadcrumb.mock.calls[0][0].data).not.toHaveProperty('details');
  });

  it('should log an auth breadcrumb with extra details', () => {
    logAuthEvent('Arrived at CleverLanding.vue', { details: { authFromClever: true } });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'auth',
      message: 'Arrived at CleverLanding.vue',
      data: { roarUid: 'testRoarUid', userType: 'student', provider: 'Clever', details: { authFromClever: true } },
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

  it('should log a profile breadcrumb', () => {
    logProfileEvent('User claims updated', {
      data: {
        adminUid: 'testAdminUid',
        assessmentUid: 'testAssessmentUid',
        roarUid: 'testRoarUid',
        userType: 'student',
      },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'profile',
      message: 'User claims updated',
      data: {
        adminUid: 'testAdminUid',
        assessmentUid: 'testAssessmentUid',
        roarUid: 'testRoarUid',
        userType: 'student',
      },
      level: 'info',
    });
  });

  it('should log an access-control breadcrumb', () => {
    logAccessEvent('User does not have permission to access route', {
      level: 'warning',
      data: { permission: 'testPermission' },
    });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'access-control',
      message: 'User does not have permission to access route',
      data: { permission: 'testPermission' },
      level: 'warning',
    });
  });
});
