import type { BaseFixture } from './base.fixture';
import { seedBaseFixture as _seedBaseFixture } from './base.fixture';

export type { BaseFixture };

/**
 * The seeded base fixture instance.
 *
 * This is populated by `seedBaseFixture()` which runs in vitest.setup.ts
 * during the global `beforeAll` hook for integration tests.
 *
 * Individual tests can import this to access the pre-seeded test data:
 *
 * @example
 * ```typescript
 * import { baseFixture } from '../test-support/fixtures';
 *
 * it('user in school sees administration assigned to district', async () => {
 *   const results = await repo.query({ userId: baseFixture.schoolAStudent.id });
 *   expect(results).toContain(baseFixture.administrationAssignedToDistrict.id);
 * });
 * ```
 */
export let baseFixture: BaseFixture;

/**
 * Seeds the base fixture and stores it for access by tests.
 *
 * Creates a realistic test data hierarchy in the database including:
 * - Organizations (districts, schools, classes, groups)
 * - Users with various roles (students, teachers, admins)
 * - Administrations assigned to org units
 * - Task variants and related test data
 *
 * The seeded data is stored in the exported `baseFixture` variable for access by tests.
 * This function is called during test setup (e.g., vitest.setup.ts beforeAll hook or server-test.ts startup).
 * Tests should NOT call this directly - use the exported `baseFixture` instead.
 *
 * @returns The seeded BaseFixture instance
 */
export async function seedBaseFixture(): Promise<BaseFixture> {
  baseFixture = await _seedBaseFixture();
  return baseFixture;
}
