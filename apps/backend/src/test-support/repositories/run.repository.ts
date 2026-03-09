import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RunRepository } from '../../repositories/run.repository';

/**
 * Mock Run Repository
 * Returns a mocked version of RunRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository.
 */
export function createMockRunRepository(): MockedObject<RunRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getRunStatsByAdministrationIds: vi.fn(),
    getByAdministrationId: vi.fn(),
  } as MockedObject<RunRepository>;
}

export type MockRunRepository = ReturnType<typeof createMockRunRepository>;
