import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RunTrialInteractionsRepository } from '../../repositories/run-trial-interactions.repository';

/**
 * Mock Run Trial Interactions Repository
 * Returns a mocked version of RunTrialInteractionsRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockRunTrialInteractionsRepository(): MockedObject<RunTrialInteractionsRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
  } as MockedObject<RunTrialInteractionsRepository>;
}

export type MockRunTrialInteractionsRepository = ReturnType<typeof createMockRunTrialInteractionsRepository>;
