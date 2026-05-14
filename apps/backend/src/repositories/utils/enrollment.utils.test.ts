import { describe, it, expect } from 'vitest';
import { SQL } from 'drizzle-orm';
import { isEnrollmentActive, isActiveRoster } from './enrollment.utils';
import { userOrgs, users, orgs, classes, groups } from '../../db/schema';

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

  describe('isActiveRoster', () => {
    it('returns a non-undefined SQL expression', () => {
      // The helper applies a non-null assertion internally so callers can
      // use it in strict `SQL` contexts (e.g., `SQL[]` array push). Verify
      // the return type is concretely SQL — not the bare `SQL | undefined`
      // that drizzle's `or()` returns.
      const condition = isActiveRoster(users);

      expect(condition).toBeDefined();
      expect(condition).toBeInstanceOf(SQL);
    });

    it('accepts the canonical users table', () => {
      const condition = isActiveRoster(users);
      expect(condition).toBeTruthy();
    });

    it.each([
      ['orgs', orgs],
      ['classes', classes],
      ['groups', groups],
    ])('accepts any table with a rosteringEnded column: %s', (_name, table) => {
      // The filter is also used against entity tables (orgs, classes, groups)
      // for the entity-level rostering-ended check in `buildStudentInScopeQuery`.
      // The helper's structural typing should accept any table with the
      // `rosteringEnded` column.
      const condition = isActiveRoster(table);
      expect(condition).toBeTruthy();
    });

    it('accepts a mock table object with just a rosteringEnded column', () => {
      // Confirms the structural-typing contract — callers don't need to
      // pass a full Drizzle table reference.
      const mockTable = { rosteringEnded: users.rosteringEnded };
      const condition = isActiveRoster(mockTable);
      expect(condition).toBeTruthy();
    });
  });
});
