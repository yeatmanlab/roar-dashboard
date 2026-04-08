import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { TaskBundleVariantRepository } from '../../repositories/task-bundle-variant.repository';

/**
 * Mock TaskBundleVariant Repository
 * Returns a mocked version of TaskBundleVariantRepository with all methods as vi.fn() mocks.
 */
export function createMockTaskBundleVariantRepository(): MockedObject<TaskBundleVariantRepository> {
  return {
    getVariantsWithTaskDetailsByBundleIds: vi.fn(),
  } as MockedObject<TaskBundleVariantRepository>;
}

export type MockTaskBundleVariantRepository = MockedObject<TaskBundleVariantRepository>;
