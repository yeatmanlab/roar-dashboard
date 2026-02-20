import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { TaskVariantRepository } from '../../repositories/task-variant.repository';

/**
 * Mock TaskVariant Repository
 * Returns a mocked version of TaskVariantRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockTaskVariantRepository(): MockedObject<TaskVariantRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getByTaskId: vi.fn(),
    getByTaskIdAndName: vi.fn(),
  } as MockedObject<TaskVariantRepository>;
}

export type MockTaskVariantRepository = MockedObject<TaskVariantRepository>;
