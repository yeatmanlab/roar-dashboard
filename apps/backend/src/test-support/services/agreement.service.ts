import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { AgreementService } from '../../services/agreement/agreement.service';

/**
 * Mock Agreement Service
 * Returns a mocked version of AgreementService with all methods as vi.fn() mocks.
 */
export function createMockAgreementService(): MockedObject<ReturnType<typeof AgreementService>> {
  return {
    list: vi.fn(),
  } as MockedObject<ReturnType<typeof AgreementService>>;
}

export type MockAgreementService = ReturnType<typeof createMockAgreementService>;
