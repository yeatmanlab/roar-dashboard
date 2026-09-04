import { vi } from 'vitest';
import { createMockBaseRepositoryMethods } from './base.repository';

export function createMockLtreeRepository() {
  return {
    ...createMockBaseRepositoryMethods(),
    getDistinctRootOrgIds: vi.fn(),
  };
}
