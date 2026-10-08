import { vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { FamilyService } from '../../services/family/family.service';

/** Returns a fully typed FamilyService mock for unit tests. */
export function createMockFamilyService(): MockedObject<ReturnType<typeof FamilyService>> {
  return {
    addChildren: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    listUsers: vi.fn(),
  } satisfies MockedObject<ReturnType<typeof FamilyService>>;
}

export type MockFamilyService = ReturnType<typeof createMockFamilyService>;
