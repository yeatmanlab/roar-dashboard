import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { RunsService } from '../../services/runs/runs.service';

/**
 * Mock Runs Service
 * Returns a mocked version of RunsService with all methods as vi.fn() mocks.
 */
export function createMockRunsService(): MockedObject<ReturnType<typeof RunsService>> {
  return {
    getRunStatsByAdministrationIds: vi.fn(),
    getByAdministrationId: vi.fn(),
  } as MockedObject<ReturnType<typeof RunsService>>;
}

export type MockRunsService = ReturnType<typeof createMockRunsService>;
