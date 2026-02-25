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
    listAuthorized: vi.fn(),
    getAuthorizedById: vi.fn(),
    getAssignedUserCountsByAdministrationIds: vi.fn(),
    getDistrictsByAdministrationId: vi.fn(),
    getAuthorizedDistrictsByAdministrationId: vi.fn(),
    getSchoolsByAdministrationId: vi.fn(),
    getAuthorizedSchoolsByAdministrationId: vi.fn(),
    getClassesByAdministrationId: vi.fn(),
    getAuthorizedClassesByAdministrationId: vi.fn(),
    getUserRolesForAdministration: vi.fn(),
    getGroupsByAdministrationId: vi.fn(),
    getAuthorizedGroupsByAdministrationId: vi.fn(),
    getTaskVariantsByAdministrationId: vi.fn(),
    getAgreementsByAdministrationId: vi.fn(),
  } as unknown as MockedObject<AdministrationRepository>;
}

export type MockAdministrationRepository = ReturnType<typeof createMockAdministrationRepository>;
