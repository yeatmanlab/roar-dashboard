import { describe, it, expect, vi } from 'vitest';
import { logBreadcrumb } from './logBreadcrumb';
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
});
