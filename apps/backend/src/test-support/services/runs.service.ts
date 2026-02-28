import { vi } from 'vitest';
import type { RunsService } from '../../services/runs/runs.service';

/**
 * Mock Runs Service
 * Returns a mocked version of RunsService with all methods as vi.fn() mocks.
 */
export function createMockRunsService(): { [K in keyof ReturnType<typeof RunsService>]: ReturnType<typeof vi.fn> } {
  return {
    getRunStatsByAdministrationIds: vi.fn(),
    getByAdministrationId: vi.fn(),
  };
}

export type MockRunsService = ReturnType<typeof createMockRunsService>;
