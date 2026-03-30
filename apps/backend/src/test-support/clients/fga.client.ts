import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { OpenFgaClient } from '@openfga/sdk';

/** The subset of OpenFgaClient methods used by AuthorizationService and AuthorizationModule. */
type FgaClientTestSurface = Pick<OpenFgaClient, 'writeTuples' | 'deleteTuples'>;

/**
 * Creates a typed mock of the OpenFGA client methods used in tests.
 *
 * Returns only the methods the codebase actually calls (`writeTuples`, `deleteTuples`),
 * typed via `Pick` so tests get full IntelliSense without an `as unknown as` cast.
 *
 * @returns A mocked FGA client surface
 */
export function createMockFgaClient(): MockedObject<FgaClientTestSurface> {
  return {
    writeTuples: vi.fn(),
    deleteTuples: vi.fn(),
  };
}

export type MockFgaClient = ReturnType<typeof createMockFgaClient>;
