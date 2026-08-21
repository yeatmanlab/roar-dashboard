import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import type { UserImportService } from '../../services/user/user-import.service';

/**
 * Mock UserImportService
 * Returns a mocked version of UserImportService with all methods as vi.fn() mocks.
 */
export function createMockUserImportService(): MockedObject<ReturnType<typeof UserImportService>> {
  return {
    bulkImport: vi.fn(),
  } satisfies MockedObject<ReturnType<typeof UserImportService>>;
}

export type MockedUserImportService = ReturnType<typeof createMockUserImportService>;
