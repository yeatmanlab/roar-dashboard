/**
 * SDK Integration Test Helper
 *
 * Provides utilities for testing the Assessment SDK against a real backend.
 * Signs in via the Firebase Auth emulator to get real ID tokens.
 */

import { initAssessmentSdk } from '../index';
import type { CommandContext } from '../command/command';
import type { TestFixture } from '@roar-platform/api-contract/test-fixture.type';

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
 * Signs in to the Firebase Auth emulator and returns an ID token.
 *
 * Uses the emulator's REST API (signInWithPassword) to authenticate with
 * the credentials seeded by the seed script. Returns a real Firebase ID token
 * that the backend's FirebaseAuthProvider can verify.
 *
 * @param email - The user's email address
 * @param password - The user's password
 * @returns The Firebase ID token
 */
async function signInWithEmulator(email: string, password: string): Promise<string> {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST is not set. ' + 'The Auth emulator must be running for SDK integration tests.',
    );
  }

  const url = `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[SDK Test] Auth emulator sign-in failed for ${email}: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { idToken?: string };
  if (!data.idToken) {
    throw new Error(`[SDK Test] Auth emulator returned no idToken for ${email}`);
  }

  return data.idToken;
}

/**
 * Cached test token populated by getBaseFixtureData().
 * This is a real Firebase ID token from the emulator.
 */
let cachedTestToken: string | null = null;

/**
 * Cached test user ID that is populated by getBaseFixtureData().
 * Must be initialized before any SDK requests that require userId path parameter.
 */
let cachedTestUserId: string | null = null;

/**
 * Cached teacher credentials populated by getBaseFixtureData().
 */
let cachedTeacherEmail: string | null = null;
let cachedTeacherPassword: string | null = null;
let cachedTeacherUserId: string | null = null;

/**
 * Creates a test auth context that uses the cached token.
 *
 * The token is a real Firebase ID token obtained from the Auth emulator.
 * It must be initialized by calling getBaseFixtureData() before making
 * any authenticated requests.
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
 * Creates an auth context for the teacher user by signing in via the emulator.
 *
 * @returns Auth context with real Firebase ID token for the teacher
 * @throws Error if teacher credentials are not initialized
 */
export async function createTeacherAuthContext() {
  if (!cachedTeacherEmail || !cachedTeacherPassword) {
    throw new Error('Teacher credentials not initialized. Call getBaseFixtureData() first.');
  }

  const token = await signInWithEmulator(cachedTeacherEmail, cachedTeacherPassword);

  return {
    getToken: async () => token,
    refreshToken: async () => token,
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
 * Reads the dev fixture data from the fixture file written by the seed script
 * and signs in to the Auth emulator to get real Firebase tokens.
 *
 * The seed script writes fixture data (task variants, users, credentials)
 * to a JSON file before the server starts. This function reads that file,
 * then uses the credentials to sign in via the Auth emulator REST API.
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
        `Ensure the seed script has run and written the fixture file. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Sign in via the Auth emulator to get a real Firebase ID token
  if (data.testUser?.email && data.testUser?.password) {
    cachedTestToken = await signInWithEmulator(data.testUser.email, data.testUser.password);
  } else {
    throw new Error(
      'Test user credentials (email/password) not found in fixture file. ' +
        'Ensure the seed script writes email and password to the fixture.',
    );
  }

  // Cache the test user's ID for path parameters
  if (data.testUser?.id) {
    cachedTestUserId = data.testUser.id;
  }

  // Cache the teacher user credentials for tests that need a different user context
  if (data.schoolATeacher) {
    cachedTeacherUserId = data.schoolATeacher.id;
    cachedTeacherEmail = data.schoolATeacher.email;
    cachedTeacherPassword = data.schoolATeacher.password;
  }

  return data;
}
