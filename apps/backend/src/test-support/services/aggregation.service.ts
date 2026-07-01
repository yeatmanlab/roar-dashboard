import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AggregationService } from '../../services/aggregation';

/**
 * Mock Aggregation Service
 * Returns a mocked version of AggregationService with aggregateSupportCategories as a vi.fn() mock.
 */
export function createMockAggregationService(): MockedObject<ReturnType<typeof AggregationService>> {
  return {
    aggregateSupportCategories: vi.fn(),
  } as unknown as MockedObject<ReturnType<typeof AggregationService>>;
}

export type MockAggregationService = ReturnType<typeof createMockAggregationService>;
