import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AdministrationAccessControls } from '../../repositories/access-controls/administration.access-controls';

/**
 * Mock Administration Access Controls
 * Returns a mocked version of AdministrationAccessControls with all methods as vi.fn() mocks.
 */
export function createMockAdministrationAccessControls(): MockedObject<AdministrationAccessControls> {
  return {
    buildUserAdministrationIdsQuery: vi.fn(),
    buildAdministrationUserAssignmentsQuery: vi.fn(),
    getAssignedUserCountsByAdministrationIds: vi.fn(),
    getUserRolesForAdministration: vi.fn(),
  } as unknown as MockedObject<AdministrationAccessControls>;
}

export type MockAdministrationAccessControls = ReturnType<typeof createMockAdministrationAccessControls>;
