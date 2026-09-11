import type { MockedObject } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';
import type { AgreementVersionRepository } from '../../repositories/agreement-version.repository';

/**
 * Mock AgreementVersion Repository
 * Returns a mocked version of AgreementVersionRepository with all methods as vi.fn() mocks.
 * This allows unit tests to avoid implementation details of the base repository.
 */
export function createMockAgreementVersionRepository(): MockedObject<AgreementVersionRepository> {
  return {
    ...createMockBaseRepositoryMethods(),
  } as MockedObject<AgreementVersionRepository>;
}

export type MockAgreementVersionRepository = ReturnType<typeof createMockAgreementVersionRepository>;
