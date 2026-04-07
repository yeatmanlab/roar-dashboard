import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AuthorizationService } from '../../services/authorization/authorization.service';

/**
 * Mock Authorization Service
 * Returns a mocked version of AuthorizationService with all methods as vi.fn() mocks.
 */
export function createMockAuthorizationService(): MockedObject<ReturnType<typeof AuthorizationService>> {
  return {
    writeTuples: vi.fn(),
    deleteTuples: vi.fn(),
    hasPermission: vi.fn(),
    requirePermission: vi.fn(),
    listAccessibleObjects: vi.fn(),
  } as MockedObject<ReturnType<typeof AuthorizationService>>;
}

export type MockAuthorizationService = ReturnType<typeof createMockAuthorizationService>;
