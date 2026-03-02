import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { TaskService } from '../../services/task/task.service';

/**
 * Mock Task Service
 * Returns a mocked version of TaskService with all methods as vi.fn() mocks.
 */
export function createMockTaskService(): MockedObject<ReturnType<typeof TaskService>> {
  return {
    createTaskVariant: vi.fn(),
    evaluateTaskVariantEligibility: vi.fn(),
  } as MockedObject<ReturnType<typeof TaskService>>;
}

export type MockTaskService = ReturnType<typeof createMockTaskService>;
