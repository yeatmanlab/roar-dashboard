import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { FoundationalCompositeService } from '../../services/foundational-composite/foundational-composite.service';

/**
 * Mock Foundational Composite Service
 * Returns a mocked version of FoundationalCompositeService with all methods as vi.fn() mocks.
 */
export function createMockFoundationalCompositeService(): MockedObject<
  ReturnType<typeof FoundationalCompositeService>
> {
  return {
    recomputeForRun: vi.fn(),
  } as MockedObject<ReturnType<typeof FoundationalCompositeService>>;
}

export type MockFoundationalCompositeService = ReturnType<typeof createMockFoundationalCompositeService>;
