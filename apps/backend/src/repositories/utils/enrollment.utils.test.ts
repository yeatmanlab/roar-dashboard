import { describe, it, expect } from 'vitest';
import { isEnrollmentActive } from './enrollment.utils';
import { userOrgs } from '../../db/schema';

describe('enrollment.utils', () => {
  describe('isEnrollmentActive', () => {
    it('returns a SQL condition for active enrollment', () => {
      const condition = isEnrollmentActive(userOrgs);

      // The function should return a truthy value (SQL expression)
      expect(condition).toBeTruthy();
    });

    it('accepts any table with enrollmentStart and enrollmentEnd columns', () => {
      // Mock table structure matching the expected interface
      const mockTable = {
        enrollmentStart: userOrgs.enrollmentStart,
        enrollmentEnd: userOrgs.enrollmentEnd,
      };

      const condition = isEnrollmentActive(mockTable);
      expect(condition).toBeTruthy();
    });
  });
});
