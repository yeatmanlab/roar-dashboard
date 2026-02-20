import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { TaskRepository } from '../../repositories/task.repository';

/**
 * Mock Task Repository
 * Returns a mocked version of TaskRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockTaskRepository(): MockedObject<TaskRepository> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(createMockBaseRepositoryMethods() as any),
    getBySlug: vi.fn(),
  } as MockedObject<TaskRepository>;
}
