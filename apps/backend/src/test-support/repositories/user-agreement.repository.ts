import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { UserAgreementRepository } from '../../repositories/user-agreement.repository';

/**
 * Mock UserAgreement Repository
 * Returns a mocked version of UserAgreementRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository.
 */
export function createMockUserAgreementRepository(): MockedObject<UserAgreementRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    findByUserIdAndAgreementVersionId: vi.fn(),
  } as MockedObject<UserAgreementRepository>;
}

export type MockUserAgreementRepository = ReturnType<typeof createMockUserAgreementRepository>;
