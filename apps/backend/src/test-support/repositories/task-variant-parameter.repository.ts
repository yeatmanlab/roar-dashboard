import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';

/**
 * Mock TaskVariant Parameter Repository
 * Returns a mocked version of TaskVariantParameterRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockTaskVariantParameterRepository(): MockedObject<TaskVariantParameterRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getByTaskVariantId: vi.fn(),
    createMany: vi.fn(),
  } as MockedObject<TaskVariantParameterRepository>;
}

export type MockTaskVariantParameterRepository = MockedObject<TaskVariantParameterRepository>;
