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
 * Creates a test auth context with a mock token.
 *
 * In test mode (NODE_ENV=test), the backend's auth middleware accepts any token string
 * without validation. This allows SDK tests to use a simple test token without requiring
 * a real Firebase authentication setup.
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
 * Fetches the backend's baseFixture data for use in integration tests.
 *
 * The backend provides a test endpoint that returns the seeded baseFixture
 * which includes task variants, administrations, and users created during setup.
 *
 * @returns The baseFixture data with task variants and other test entities
 */
export async function getBaseFixtureData(): Promise<{
  variantForAllGrades: { id: string };
  variantForGrade5: { id: string };
  variantForGrade3: { id: string };
  variantOptionalForEll: { id: string };
  variantForTask2: { id: string };
  variantForTask2Grade5OptionalEll: { id: string };
}> {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/v1/test/fixture`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch baseFixture data: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{
    variantForAllGrades: { id: string };
    variantForGrade5: { id: string };
    variantForGrade3: { id: string };
    variantOptionalForEll: { id: string };
    variantForTask2: { id: string };
    variantForTask2Grade5OptionalEll: { id: string };
  }>;
}
