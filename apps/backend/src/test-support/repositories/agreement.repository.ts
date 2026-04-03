import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { AgreementRepository } from '../../repositories/agreement.repository';

/**
 * Mock Agreement Repository
 * Returns a mocked version of AgreementRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository.
 */
export function createMockAgreementRepository(): MockedObject<AgreementRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
    listAll: vi.fn(),
    getVersionsByAgreementIds: vi.fn(),
  } as MockedObject<AgreementRepository>;
}

export type MockAgreementRepository = ReturnType<typeof createMockAgreementRepository>;
