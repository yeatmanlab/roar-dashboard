import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AdministrationService } from '../../services/administration/administration.service';

/**
 * Mock Administration Service
 * Returns a mocked version of AdministrationService with all methods as vi.fn() mocks.
 */
export function createMockAdministrationService(): MockedObject<ReturnType<typeof AdministrationService>> {
  return {
    verifyAdministrationAccess: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    listDistricts: vi.fn(),
    listSchools: vi.fn(),
    listClasses: vi.fn(),
    listGroups: vi.fn(),
    listTaskVariants: vi.fn(),
    listAgreements: vi.fn(),
    deleteById: vi.fn(),
  } as MockedObject<ReturnType<typeof AdministrationService>>;
}

export type MockAdministrationService = ReturnType<typeof createMockAdministrationService>;
