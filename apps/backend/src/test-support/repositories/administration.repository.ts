import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { AdministrationRepository } from '../../repositories/administration.repository';

/**
 * Mock Administration Repository
 * Returns a mocked version of AdministrationRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository (typedTable, db, etc.).
 */
export function createMockAdministrationRepository(): MockedObject<AdministrationRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    listAll: vi.fn(),
    getAssignedUserCountsByAdministrationIds: vi.fn(),
    getAssignees: vi.fn(),
    getTaskVariantsByAdministrationId: vi.fn(),
    getAgreementsByAdministrationId: vi.fn(),
    getTreeNodes: vi.fn(),
    getRootTreeNodes: vi.fn(),
    getDistrictChildTreeNodes: vi.fn(),
    getSchoolChildTreeNodes: vi.fn(),
    createWithAssignments: vi.fn(),
    updateWithAssignments: vi.fn(),
    existsByName: vi.fn(),
    existsByNameExcludingId: vi.fn(),
  } as unknown as MockedObject<AdministrationRepository>;
}

export type MockAdministrationRepository = ReturnType<typeof createMockAdministrationRepository>;
