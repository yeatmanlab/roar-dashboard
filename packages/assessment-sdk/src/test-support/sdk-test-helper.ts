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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const port = (globalThis as any).__BACKEND_PORT__ || process.env.BACKEND_PORT || '4001';
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
 */
export function createTestAuthContext() {
  return {
    getToken: async () => 'test-token-' + Math.random().toString(36).slice(2),
    refreshToken: async () => 'test-token-' + Math.random().toString(36).slice(2),
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
