import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { RoarApi } from '../receiver/roar-api';

/**
 * Mock ROAR API
 * Returns a mocked version of RoarApi with all methods as vi.fn() mocks.
 * Provides a properly typed mock for testing commands that depend on RoarApi.
 */
export function createMockRoarApi() {
  const createRunMock = vi.fn() as Mock;

  return {
    client: {
      runs: {
        create: createRunMock,
      },
    },
  } as unknown as RoarApi;
}

export type MockRoarApi = ReturnType<typeof createMockRoarApi>;
