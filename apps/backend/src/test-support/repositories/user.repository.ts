import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { UserRepository } from '../../repositories/user.repository';

/**
 * Mock User Repository
 * Returns a mocked version of UserRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockUserRepository(): MockedObject<UserRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    findByAuthId: vi.fn(),
    getAuthorizedById: vi.fn(),
    getUserEntityMemberships: vi.fn(),
  } as MockedObject<UserRepository>;
}

export type MockUserRepository = ReturnType<typeof createMockUserRepository>;
