import { describe, it, expect } from 'vitest';
import { isAuthorizedMembership } from './is-authorized-membership.utils';
import { userOrgs, userClasses, userGroups } from '../../db/schema';

describe('is-authorized-membership.utils', () => {
  describe('isAuthorizedMembership', () => {
    const testUserId = 'test-user-id';
    const testRoles = ['student', 'teacher'];

    it('returns a SQL condition for authorized membership', () => {
      const condition = isAuthorizedMembership(userOrgs, testUserId, testRoles);

      // The function should return a truthy value (SQL expression)
      expect(condition).toBeTruthy();
    });

    it('works with userOrgs table', () => {
      const condition = isAuthorizedMembership(userOrgs, testUserId, testRoles);
      expect(condition).toBeTruthy();
    });

    it('works with userClasses table', () => {
      const condition = isAuthorizedMembership(userClasses, testUserId, testRoles);
      expect(condition).toBeTruthy();
    });

    it('works with userGroups table', () => {
      const condition = isAuthorizedMembership(userGroups, testUserId, testRoles);
      expect(condition).toBeTruthy();
    });

    it('accepts any table with required columns', () => {
      // Mock table structure matching the expected interface
      const mockTable = {
        userId: userOrgs.userId,
        role: userOrgs.role,
        enrollmentStart: userOrgs.enrollmentStart,
        enrollmentEnd: userOrgs.enrollmentEnd,
      };

      const condition = isAuthorizedMembership(mockTable, testUserId, testRoles);
      expect(condition).toBeTruthy();
    });
  });
});
