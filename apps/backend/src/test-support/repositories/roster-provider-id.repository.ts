import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { RosterProviderIdRepository } from '../../repositories/roster-provider-id.repository';

/**
 * Mock RosterProviderIdRepository
 * Returns a mocked version of RosterProviderIdRepository with all methods as vi.fn() mocks.
 * This allows unit tests to acoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockRosterProviderIdRepository(): MockedObject<RosterProviderIdRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
  } as MockedObject<RosterProviderIdRepository>;
}

export type MockRosterProviderIdRepository = ReturnType<typeof createMockRosterProviderIdRepository>;
