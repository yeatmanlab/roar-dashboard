import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AuthorizationService } from '../../services/authorization/authorization.service';

/**
 * Mock Authorization Service
 * Returns a mocked version of AuthorizationService with all methods as vi.fn() mocks.
 */
export function createMockAuthorizationService(): MockedObject<ReturnType<typeof AuthorizationService>> {
  return {
    writeTuples: vi.fn().mockResolvedValue(undefined),
    deleteTuples: vi.fn().mockResolvedValue(undefined),
    hasPermission: vi.fn().mockResolvedValue(false),
    requirePermission: vi.fn().mockResolvedValue(undefined),
    listAccessibleObjects: vi.fn().mockResolvedValue([]),
    hasAnyPermission: vi.fn().mockResolvedValue(false),
  } as MockedObject<ReturnType<typeof AuthorizationService>>;
}

export type MockAuthorizationService = ReturnType<typeof createMockAuthorizationService>;
