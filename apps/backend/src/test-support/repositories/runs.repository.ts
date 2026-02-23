import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { RunsRepository } from '../../repositories/runs.repository';

/**
 * Mock Runs Repository
 * Returns a mocked version of RunsRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the repository.
 */
export function createMockRunsRepository(): MockedObject<RunsRepository> {
  return {
    getRunStatsByAdministrationIds: vi.fn(),
  } as MockedObject<RunsRepository>;
}

export type MockRunsRepository = ReturnType<typeof createMockRunsRepository>;
