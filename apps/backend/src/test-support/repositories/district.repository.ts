import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { DistrictRepository } from '../../repositories/district.repository';

/**
 * Mock District Repository
 * Returns a mocked version of DistrictRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockDistrictRepository(): MockedObject<DistrictRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    listAll: vi.fn(),
    listAuthorized: vi.fn(),
    getUnrestrictedById: vi.fn(),
    getAuthorizedById: vi.fn(),
    getUserRolesForDistrict: vi.fn(),
  } as unknown as MockedObject<DistrictRepository>;
}

export type MockDistrictRepository = ReturnType<typeof createMockDistrictRepository>;
