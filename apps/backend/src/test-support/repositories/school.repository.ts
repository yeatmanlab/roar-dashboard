import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { SchoolRepository } from '../../repositories/school.repository';
import { createMockLtreeRepository } from './l-tree.repository';

/**
 * Mock School Repository
 * Returns a mocked version of SchoolRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockSchoolRepository(): MockedObject<SchoolRepository> {
  return {
    ...createMockLtreeRepository(),
    listAll: vi.fn(),
    listByIds: vi.fn(),
    listAccessibleByDistrictId: vi.fn(),
    getUnrestrictedById: vi.fn(),
    listAllByDistrictId: vi.fn(),
    getUsersBySchoolId: vi.fn(),
    createSchool: vi.fn(),
    getActiveById: vi.fn(),
  } as unknown as MockedObject<SchoolRepository>;
}

export type MockSchoolRepository = ReturnType<typeof createMockSchoolRepository>;
