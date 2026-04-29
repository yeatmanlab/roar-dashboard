import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { UserService } from '../../services/user/user.service';

/**
 * Mock UserService
 * Returns a mocked version of UserService with all methods as vi.fn() mocks.
 */
export function createMockUserService(): MockedObject<ReturnType<typeof UserService>> {
  return {
    findByAuthId: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    recordUserAgreement: vi.fn(),
    getUnsignedTosAgreements: vi.fn(),
  } as MockedObject<ReturnType<typeof UserService>>;
}

export type MockedUserService = ReturnType<typeof createMockUserService>;
