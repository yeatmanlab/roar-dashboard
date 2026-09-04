import { describe, it, expect } from 'vitest';
import { SQL, sql } from 'drizzle-orm';
import {
  isEnrollmentActive,
  isActiveRoster,
  isEnrollmentActiveForAdmin,
  hasWithdrawnWithDataForAdmin,
} from './enrollment.utils';
import { userOrgs, userClasses, userGroups, users, orgs, classes, groups, administrations } from '../../db/schema';

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

  describe('isEnrollmentActiveForAdmin', () => {
    // The admin-aware sibling of `isEnrollmentActive` introduced by #1792.
    // Behavioral correctness (does the SQL produce the right rows?) is
    // covered by integration tests against a real DB; these unit tests
    // assert the structural contract — accepts the documented table
    // shapes, accepts both a column reference and a SQL expression for
    // the admin date, and does not regress `isEnrollmentActive` for
    // callers outside reporting.

    it('returns a SQL condition accepting a column reference for admin date', () => {
      const condition = isEnrollmentActiveForAdmin(userOrgs, administrations.dateEnd);
      expect(condition).toBeTruthy();
    });

    it('returns a SQL condition accepting a SQL expression for admin date', () => {
      const condition = isEnrollmentActiveForAdmin(userOrgs, sql`'2025-01-01'::timestamptz`);
      expect(condition).toBeTruthy();
    });

    it.each([
      ['userOrgs', userOrgs],
      ['userClasses', userClasses],
      ['userGroups', userGroups],
    ])('accepts each junction table the reporting query joins against: %s', (_name, table) => {
      const condition = isEnrollmentActiveForAdmin(table, administrations.dateEnd);
      expect(condition).toBeTruthy();
    });

    it('accepts a mock table with just enrollmentStart and enrollmentEnd', () => {
      const mockTable = {
        enrollmentStart: userOrgs.enrollmentStart,
        enrollmentEnd: userOrgs.enrollmentEnd,
      };
      const condition = isEnrollmentActiveForAdmin(mockTable, administrations.dateEnd);
      expect(condition).toBeTruthy();
    });
  });

  describe('hasWithdrawnWithDataForAdmin', () => {
    it('returns a SQL condition wiring the runs EXISTS subquery', () => {
      const condition = hasWithdrawnWithDataForAdmin(
        userOrgs,
        administrations.dateStart,
        administrations.dateEnd,
        users.id,
        administrations.id,
      );
      expect(condition).toBeTruthy();
    });

    it('accepts SQL expressions for admin date columns', () => {
      // For multi-scope queries the admin dates may already be expressed
      // as SQL fragments rather than column references — verify the
      // signature accommodates both.
      const condition = hasWithdrawnWithDataForAdmin(
        userOrgs,
        sql`'2024-09-01'::timestamptz`,
        sql`'2025-06-30'::timestamptz`,
        users.id,
        administrations.id,
      );
      expect(condition).toBeTruthy();
    });

    it.each([
      ['userOrgs', userOrgs],
      ['userClasses', userClasses],
      ['userGroups', userGroups],
    ])('accepts each junction table: %s', (_name, table) => {
      const condition = hasWithdrawnWithDataForAdmin(
        table,
        administrations.dateStart,
        administrations.dateEnd,
        users.id,
        administrations.id,
      );
      expect(condition).toBeTruthy();
    });
  });

  // Note: an earlier draft of #1792 also exported a `hasQualifyingRunsForAdmin`
  // helper that did a bare `runs`-EXISTS check correlated only by
  // `(userId, administrationId)`. It was removed during review — the
  // per-student endpoint must stay scope-gated, so `verifyStudentInScope`
  // now routes through `buildStudentInScopeQuery(scope, admin, true)`
  // instead. Don't reintroduce a scope-less EXISTS helper.

  describe('isEnrollmentActive (regression — unchanged by #1792)', () => {
    it('still returns a SQL condition for the canonical junction tables', () => {
      // Defensive: ensure adding the admin-aware siblings did not silently
      // change the behavior of the existing helper, which is used by 7+
      // non-reporting repositories that legitimately want "active as of
      // NOW()". See `quality-no-followup-prs` + the #1792 ticket's
      // "do not repurpose globally" note.
      expect(isEnrollmentActive(userOrgs)).toBeTruthy();
      expect(isEnrollmentActive(userClasses)).toBeTruthy();
      expect(isEnrollmentActive(userGroups)).toBeTruthy();
    });
  });
});
