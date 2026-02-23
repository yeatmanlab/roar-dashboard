import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RunsRepository } from '../../repositories/runs.repository';

/**
 * Mock Runs Repository
 * Returns a mocked version of RunsRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockRunRepository(): MockedObject<RunsRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getRunStatsByAdministrationIds: vi.fn(),
  } as MockedObject<RunsRepository>;
}

export type MockRunRepository = ReturnType<typeof createMockRunRepository>;
