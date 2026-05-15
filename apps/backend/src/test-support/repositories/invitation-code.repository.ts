import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { InvitationCodeRepository } from '../../repositories/invitation-code.repository';

/**
 * Mock Invitation Code Repository
 * Returns a mocked version of InvitationCodeRepository with all methods as vi.fn() mocks.
 */
export function createMockInvitationCodeRepository(): MockedObject<InvitationCodeRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    findValidByCode: vi.fn(),
    getLatestValidByGroupId: vi.fn(),
  } as unknown as MockedObject<InvitationCodeRepository>;
}

export type MockInvitationCodeRepository = ReturnType<typeof createMockInvitationCodeRepository>;
