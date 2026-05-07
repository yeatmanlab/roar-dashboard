import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockLtreeRepository } from './l-tree.repository';
import type { ClassRepository } from '../../repositories/class.repository';

/**
 * Mock Class Repository
 * Returns a mocked version of ClassRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockClassRepository(): MockedObject<ClassRepository> {
  return {
    ...createMockLtreeRepository(),
    getUsersByClassId: vi.fn(),
    listBySchoolId: vi.fn(),
    createClass: vi.fn(),
    getDistinctRootOrgIds: vi.fn(),
  } as unknown as MockedObject<ClassRepository>;
}

export type MockClassRepository = ReturnType<typeof createMockClassRepository>;
