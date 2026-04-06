import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { TaskVariantService } from '../../services/task-variant/task-veriant.service';

/**
 * Mock TaskVariant Service
 * Returns a mocked version of TaskVariantService with all methods as vi.fn() mocks.
 */
export function createMockTaskVariantService(): MockedObject<ReturnType<typeof TaskVariantService>> {
  return {
    listAllPublished: vi.fn(),
  } as MockedObject<ReturnType<typeof TaskVariantService>>;
}

export type MockTaskVariantService = ReturnType<typeof createMockTaskVariantService>;
