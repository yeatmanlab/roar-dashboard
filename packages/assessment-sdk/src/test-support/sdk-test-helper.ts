/**
 * SDK Integration Test Helper
 *
 * Provides utilities for testing the Assessment SDK against a real backend.
 */

import { initAssessmentSdk } from '../index';
import type { CommandContext } from '../command/command';

/**
 * Gets the backend port from the global setup.
 * Falls back to environment variable or default.
 */
export function getBackendPort(): string {
  const port = (globalThis as { __BACKEND_PORT__?: string }).__BACKEND_PORT__ || process.env.BACKEND_PORT || '4001';
  return port;
}

/**
 * Gets the backend base URL.
 */
export function getBackendUrl(): string {
  const port = getBackendPort();
  return `http://localhost:${port}`;
}

/**
 * Creates a test auth context with a cached token.
 *
 * In test mode (NODE_ENV=test), TestAuthProvider treats the token directly as the Firebase UID.
 * The token must be a real user's authId from the seeded database — getBaseFixtureData() fetches
 * schoolAStudent.authId and caches it here before any authenticated requests are made.
 *
 * The token is cached and reused across all tests for performance.
 *
 * @returns Auth context with getToken and refreshToken methods
 */
let cachedTestToken: string | null = null;

export function createTestAuthContext() {
  if (!cachedTestToken) {
    cachedTestToken = 'test-token-' + Math.random().toString(36).slice(2);
  }

  return {
    getToken: async () => cachedTestToken!,
    refreshToken: async () => cachedTestToken!,
  };
}

/**
 * Initializes the SDK for integration tests.
 *
 * @param overrides - Optional overrides for the context
 * @returns Initialized SDK with invoker and api
 */
export function initTestSdk(overrides: Partial<CommandContext> = {}) {
  const baseUrl = getBackendUrl();
  const participantId = 'test-participant-' + Math.random().toString(36).slice(2);

  const context: CommandContext = {
    baseUrl,
    auth: createTestAuthContext(),
    participant: {
      participantId,
    },
    requestId: () => Math.random().toString(36).slice(2),
    logger: console,
    ...overrides,
  };

  return initAssessmentSdk(context);
}

/**
 * Reads the backend's baseFixture data from the fixture file written by server-test.ts.
 *
 * The test server entrypoint writes fixture data (task variants, users, etc.) to a JSON file
 * during startup. This function reads that file instead of making an HTTP call, avoiding
 * race conditions and keeping test infrastructure out of production code.
 *
 * @returns The baseFixture data with task variants and other test entities
 */
export async function getBaseFixtureData(): Promise<{
  testUser: { authId: string };
  administrationAssignedToDistrict: { id: string };
  administrationAssignedToDistrictB: { id: string };
  variantForAllGrades: { id: string };
  variantForGrade5: { id: string };
  variantForGrade3: { id: string };
  variantOptionalForEll: { id: string };
  variantForTask2: { id: string };
  variantForTask2Grade5OptionalEll: { id: string };
}> {
  const fixtureFile = process.env.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json';

  // Import fs dynamically to avoid issues in browser environments
  const { readFileSync } = await import('fs');

  let data: Awaited<ReturnType<typeof getBaseFixtureData>>;

  try {
    const content = readFileSync(fixtureFile, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to read fixture data from ${fixtureFile}. ` +
        `Ensure server-test.ts has started and written the fixture file. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Cache the test user's authId as the token for subsequent requests
  if (data.testUser?.authId) {
    cachedTestToken = data.testUser.authId;
  }

  return data;
}
