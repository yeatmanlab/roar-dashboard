import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { TaskBundleRepository } from '../../repositories/task-bundle.repository';

/**
 * Mock TaskBundle Repository
 * Returns a mocked version of TaskBundleRepository with all methods as vi.fn() mocks.
 */
export function createMockTaskBundleRepository(): MockedObject<TaskBundleRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    listAll: vi.fn(),
  } as MockedObject<TaskBundleRepository>;
}

export type MockTaskBundleRepository = MockedObject<TaskBundleRepository>;
