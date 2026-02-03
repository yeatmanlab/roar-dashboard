import { seedBaseFixture as _seedBaseFixture, type BaseFixture } from './base.fixture';

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
 * Called by vitest.setup.ts during the global `beforeAll` hook.
 * Tests should NOT call this directly - use the exported `baseFixture` instead.
 */
export async function seedBaseFixture(): Promise<BaseFixture> {
  baseFixture = await _seedBaseFixture();
  return baseFixture;
}
