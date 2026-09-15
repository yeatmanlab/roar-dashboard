import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RunScoresRepository } from '../../repositories/run-scores.repository';

/**
 * Mock Run Scores Repository
 * Returns a mocked version of RunScoresRepository with all methods as vi.fn() mocks.
 */
export function createMockRunScoresRepository(): MockedObject<RunScoresRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    upsertMany: vi.fn(),
  } as MockedObject<RunScoresRepository>;
}

export type MockRunScoresRepository = ReturnType<typeof createMockRunScoresRepository>;
