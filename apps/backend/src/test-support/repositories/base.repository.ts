import { vi } from 'vitest';

/**
 * Helper that returns mocked versions of all BaseRepository methods.
 * Use this to avoid repeating these in every repository mock.
 */
export function createMockBaseRepositoryMethods() {
  return {
    getById: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    runTransaction: vi.fn(),
  };
}
