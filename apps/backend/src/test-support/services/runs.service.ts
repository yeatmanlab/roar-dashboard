import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { RunService } from '../../services/run/run.service';

/**
 * Mock Run Service
 * Returns a mocked version of RunService with all methods as vi.fn() mocks.
 */
export function createMockRunService(): MockedObject<ReturnType<typeof RunService>> {
  return {
    create: vi.fn(),
  } as MockedObject<ReturnType<typeof RunService>>;
}

export type MockRunService = ReturnType<typeof createMockRunService>;
