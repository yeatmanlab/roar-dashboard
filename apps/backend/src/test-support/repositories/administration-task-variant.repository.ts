import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';

/**
 * Mock AdministrationTaskVariant Repository
 * Returns a mocked version of AdministrationTaskVariantRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the repository.
 */
export function createMockAdministrationTaskVariantRepository(): MockedObject<AdministrationTaskVariantRepository> {
  return {
    getByAdministrationIds: vi.fn(),
  } as MockedObject<AdministrationTaskVariantRepository>;
}

export type MockAdministrationTaskVariantRepository = ReturnType<typeof createMockAdministrationTaskVariantRepository>;
