import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { GroupRepository } from '../../repositories/group.repository';

/**
 * Mock Group Repository
 * Returns a mocked version of GroupRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockGroupRepository(): MockedObject<GroupRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getAuthorizedById: vi.fn(),
    getUserRolesForGroup: vi.fn(),
    getUsersByGroupId: vi.fn(),
    getAuthorizedUsersByGroupId: vi.fn(),
  } as unknown as MockedObject<GroupRepository>;
}

export type MockGroupRepository = ReturnType<typeof createMockGroupRepository>;
