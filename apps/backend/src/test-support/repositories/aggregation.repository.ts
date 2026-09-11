import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AggregationRepository } from '../../repositories/aggregation.repository';

/**
 * Mock Aggregation Repository
 * Returns a mocked version of AggregationRepository with all methods as vi.fn() mocks.
 */
export function createMockAggregationRepository(): MockedObject<AggregationRepository> {
  return {
    getBestRunsForVariants: vi.fn(),
    getDemographicsByRunIds: vi.fn(),
    getScoresByRunIds: vi.fn(),
    getUserSchoolsByUserIds: vi.fn(),
  } as unknown as MockedObject<AggregationRepository>;
}

export type MockAggregationRepository = ReturnType<typeof createMockAggregationRepository>;
