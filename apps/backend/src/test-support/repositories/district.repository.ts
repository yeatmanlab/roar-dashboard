import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { DistrictRepository } from '../../repositories/district.repository';
import { createMockLtreeRepository } from './l-tree.repository';

/**
 * Mock District Repository
 * Returns a mocked version of DistrictRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockDistrictRepository(): MockedObject<DistrictRepository> {
  return {
    ...createMockLtreeRepository(),
    listAll: vi.fn(),
    listByIds: vi.fn(),
    getUnrestrictedById: vi.fn(),
    getUsersByDistrictPath: vi.fn(),
    createDistrict: vi.fn(),
  } as unknown as MockedObject<DistrictRepository>;
}

export type MockDistrictRepository = ReturnType<typeof createMockDistrictRepository>;
