import { vi } from 'vitest';
import type { TaskService } from '../../services/task/task.service';

/**
 * Mock Task Service
 * Returns a mocked version of TaskService with all methods as vi.fn() mocks.
 */
export function createMockTaskService(): { [K in keyof ReturnType<typeof TaskService>]: ReturnType<typeof vi.fn> } {
  return {
    createTaskVariant: vi.fn(),
    evaluateTaskVariantEligibility: vi.fn(),
  };
}

export type MockTaskService = ReturnType<typeof createMockTaskService>;
