import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { TaskBundleService } from '../../services/task-bundle/task-bundle.service';

/**
 * Mock TaskBundle Service
 * Returns a mocked version of TaskBundleService with all methods as vi.fn() mocks.
 */
export function createMockTaskBundleService(): MockedObject<ReturnType<typeof TaskBundleService>> {
  return {
    list: vi.fn(),
  } as MockedObject<ReturnType<typeof TaskBundleService>>;
}

export type MockTaskBundleService = ReturnType<typeof createMockTaskBundleService>;
