import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { FamilyRepository } from '../../repositories/family.repository';

/**
 * Mock Family Repository
 * Returns a mocked version of FamilyRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockFamilyRepository(): MockedObject<FamilyRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    getFamilyIdsForUser: vi.fn(),
    getUsersByFamilyId: vi.fn(),
  } as unknown as MockedObject<FamilyRepository>;
}

export type MockFamilyRepository = ReturnType<typeof createMockFamilyRepository>;
