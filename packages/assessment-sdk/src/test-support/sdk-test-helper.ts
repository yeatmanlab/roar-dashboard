/**
 * SDK Integration Test Helper
 *
 * Provides utilities for testing the Assessment SDK against a real backend.
 */

import { initAssessmentSdk } from '../index';
import type { CommandContext } from '../command/command';
import type { TestFixture } from '@roar-dashboard/api-contract/test-fixture.type';

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
  return `http://localhost:${port}/v1`;
}

/**
 * Cached test token that is populated by getBaseFixtureData().
 * Must be initialized before any authenticated SDK requests are made.
 */
let cachedTestToken: string | null = null;

/**
 * Cached test user ID that is populated by getBaseFixtureData().
 * Must be initialized before any SDK requests that require userId path parameter.
 */
let cachedTestUserId: string | null = null;

/**
 * Cached teacher user ID that is populated by getBaseFixtureData().
 * Used for tests that need a different user context.
 */
let cachedTeacherUserId: string | null = null;

/**
 * Creates a test auth context that uses the cached token.
 *
 * The token must be initialized by calling getBaseFixtureData() before making any authenticated requests.
 * This ensures the SDK uses the actual test user's authId from the seeded database.
 *
 * @returns Auth context object with getToken and refreshToken async methods
 * @throws Error if called before getBaseFixtureData() has initialized the token
 */
export function createTestAuthContext() {
  return {
    getToken: async () => {
      if (!cachedTestToken) {
        throw new Error('Test token not initialized. Call getBaseFixtureData() first.');
      }
      return cachedTestToken;
    },
    refreshToken: async () => {
      if (!cachedTestToken) {
        throw new Error('Test token not initialized. Call getBaseFixtureData() first.');
      }
      return cachedTestToken;
    },
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
 * Gets the cached test user ID.
 * Must be initialized by calling getBaseFixtureData() first.
 *
 * @returns The test user's UUID
 * @throws Error if called before getBaseFixtureData() has initialized the ID
 */
export function getTestUserId(): string {
  if (!cachedTestUserId) {
    throw new Error('Test user ID not initialized. Call getBaseFixtureData() first.');
  }
  return cachedTestUserId;
}

/**
 * Gets the cached teacher user ID.
 * Must be initialized by calling getBaseFixtureData() first.
 *
 * @returns The teacher user's UUID
 * @throws Error if called before getBaseFixtureData() has initialized the ID
 */
export function getTeacherUserId(): string {
  if (!cachedTeacherUserId) {
    throw new Error('Teacher user ID not initialized. Call getBaseFixtureData() first.');
  }
  return cachedTeacherUserId;
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
export async function getBaseFixtureData(): Promise<TestFixture> {
  const fixtureFile = process.env.TEST_FIXTURE_FILE || '/tmp/roar-test-fixture.json';

  // Import fs dynamically to avoid issues in browser environments
  const { readFileSync } = await import('fs');

  let data: TestFixture;

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

  // Cache the test user's ID for path parameters
  if (data.testUser?.id) {
    cachedTestUserId = data.testUser.id;
  }

  // Cache the teacher user's ID for tests that need a different user context
  if (data.schoolATeacher?.id) {
    cachedTeacherUserId = data.schoolATeacher.id;
  }

  return data;
}
