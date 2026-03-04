import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RunTrialsRepository } from '../../repositories/run-trials.repository';

/**
 * Mock Run Trial Repository
 * Returns a mocked version of RunTrialsRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockRunTrialRepository(): MockedObject<RunTrialsRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
  } as MockedObject<RunTrialsRepository>;
}

export type MockRunTrialRepository = ReturnType<typeof createMockRunTrialRepository>;
