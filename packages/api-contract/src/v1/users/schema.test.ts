/**
 * Contract-level tests for `CreateUserRequestBodySchema.memberships`.
 *
 * `POST /users` authorizes every membership with `can_create_users` against the org it
 * names. A family is not an org — it has no hierarchy for that permission to traverse —
 * so a family membership here would reach the write with no authorization check at all.
 * The endpoint therefore accepts org-scoped memberships only, and rejection happens at
 * the contract boundary rather than in the service: narrowing the type is what makes the
 * unauthorized branch unreachable instead of merely guarded.
 *
 * Family membership is created through the families endpoints (`POST /families`,
 * `POST /families/:familyId/users`), which authorize against the family itself.
 *
 * See https://github.com/yeatmanlab/roar-project-management/issues/2129.
 */
import { describe, it, expect } from 'vitest';
import { CreateUserRequestBodySchema, ImportUserRowSchema } from './schema';

const VALID_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function bodyWithMemberships(memberships: unknown[]) {
  return {
    email: 'student@example.com',
    password: 'password123',
    name: { first: 'Test', last: 'Student' },
    memberships,
  };
}

describe('CreateUserRequestBodySchema.memberships', () => {
  it.each(['district', 'school', 'class', 'group'])('accepts a %s membership', (entityType) => {
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([{ entityType, entityId: VALID_UUID, role: 'student' }]),
    );

    expect(result.success).toBe(true);
  });

  it('rejects a family membership', () => {
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([{ entityType: 'family', entityId: VALID_UUID, role: 'parent' }]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a family membership with role 'child'", () => {
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([{ entityType: 'family', entityId: VALID_UUID, role: 'child' }]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a body mixing org and family memberships', () => {
    // The whole request fails rather than silently dropping the family entry — a partial
    // success would create the user with fewer memberships than the caller asked for.
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([
        { entityType: 'district', entityId: VALID_UUID, role: 'student' },
        { entityType: 'family', entityId: VALID_UUID, role: 'parent' },
      ]),
    );

    expect(result.success).toBe(false);
  });

  it("rejects 'child' as an org role", () => {
    // 'child' is a family role only; it is absent from the OneRoster set used for orgs.
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([{ entityType: 'district', entityId: VALID_UUID, role: 'child' }]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects an empty memberships array', () => {
    const result = CreateUserRequestBodySchema.safeParse(bodyWithMemberships([]));

    expect(result.success).toBe(false);
  });
});

/**
 * The same boundary for `POST /users/import`, which reuses `OrgMembershipSchema` for the same
 * reason: bulk import authorizes each row against the orgs its memberships name, so a family
 * membership would reach the write unauthorized — and in bulk form, many rows per request.
 *
 * A dashboard CSV can carry a Family column, so these pin what happens when one arrives on a row
 * whose memberships are actually read (create and update). Note the rejection is a whole-request
 * 400, not a per-row failure in the multi-status body: schema validation runs before any row is
 * classified.
 */
describe('ImportUserRowSchema.memberships', () => {
  function importRow(memberships: unknown[], overrides: Record<string, unknown> = {}) {
    return {
      email: 'student@example.com',
      name: { first: 'Test', last: 'Student' },
      memberships,
      ...overrides,
    };
  }

  it.each(['district', 'school', 'class', 'group'])('accepts a %s membership', (entityType) => {
    const result = ImportUserRowSchema.safeParse(importRow([{ entityType, entityId: VALID_UUID, role: 'student' }]));

    expect(result.success).toBe(true);
  });

  it.each(['parent', 'child'])("rejects a family membership with role '%s'", (role) => {
    const result = ImportUserRowSchema.safeParse(importRow([{ entityType: 'family', entityId: VALID_UUID, role }]));

    expect(result.success).toBe(false);
  });

  it('rejects a row mixing org and family memberships', () => {
    const result = ImportUserRowSchema.safeParse(
      importRow([
        { entityType: 'school', entityId: VALID_UUID, role: 'student' },
        { entityType: 'family', entityId: VALID_UUID, role: 'parent' },
      ]),
    );

    expect(result.success).toBe(false);
  });

  it('accepts an unenroll row with no memberships', () => {
    // Unenroll acts on the target's actual memberships, so the min-1 rule is relaxed for it.
    const result = ImportUserRowSchema.safeParse(importRow([], { unenroll: true }));

    expect(result.success).toBe(true);
  });

  it('rejects a non-unenroll row with no memberships', () => {
    const result = ImportUserRowSchema.safeParse(importRow([]));

    expect(result.success).toBe(false);
  });
});

/**
 * The username becomes the login address (`<username>@roar-auth.com`) and is immutable once set, so
 * a malformed one is permanent. The rule must stay a subset of an email local part; the dashboard
 * mirrors it in `isUsernameValid` (apps/dashboard/src/helpers/userFieldValidators.js).
 */
describe('CreateUserRequestBodySchema.username', () => {
  function bodyWithUsername(username: unknown) {
    return {
      ...bodyWithMemberships([{ entityType: 'school', entityId: VALID_UUID, role: 'student' }]),
      username,
    };
  }

  it('is optional', () => {
    const result = CreateUserRequestBodySchema.safeParse(
      bodyWithMemberships([{ entityType: 'school', entityId: VALID_UUID, role: 'student' }]),
    );

    expect(result.success).toBe(true);
  });

  it.each(['ada', 'ada1', 'Ada', "o'brien", 'ada.lovelace', 'ada_lovelace', 'ada-lovelace', 'a.b-c_d', 'a'.repeat(64)])(
    'accepts %s',
    (username) => {
      expect(CreateUserRequestBodySchema.safeParse(bodyWithUsername(username)).success).toBe(true);
    },
  );

  it.each([
    ['', 'empty'],
    ['ada lovelace', 'a space'],
    ['ada@school.org', 'an at sign'],
    ['_ada', 'a leading separator'],
    ['ada_', 'a trailing separator'],
    ['.ada', 'a leading dot'],
    ['ada__lovelace', 'consecutive separators'],
    ['ada!', 'punctuation outside the allowed set'],
    ['a'.repeat(65), 'more than 64 characters'],
  ])('rejects %s (%s)', (username) => {
    expect(CreateUserRequestBodySchema.safeParse(bodyWithUsername(username)).success).toBe(false);
  });

  it('rejects a non-string username', () => {
    expect(CreateUserRequestBodySchema.safeParse(bodyWithUsername(42)).success).toBe(false);
  });

  it('applies the same rule to import rows', () => {
    const row = {
      email: 'student@example.com',
      name: { first: 'Test', last: 'Student' },
      memberships: [{ entityType: 'school', entityId: VALID_UUID, role: 'student' }],
    };

    expect(ImportUserRowSchema.safeParse({ ...row, username: 'ada' }).success).toBe(true);
    expect(ImportUserRowSchema.safeParse({ ...row, username: 'ada lovelace' }).success).toBe(false);
    expect(ImportUserRowSchema.safeParse({ ...row, username: 'a'.repeat(65) }).success).toBe(false);
  });
});
