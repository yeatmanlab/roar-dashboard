import { vi } from 'vitest';

/**
 * Helper that returns mocked versions of all BaseRepository methods.
 * Use this to avoid repeating these in every repository mock.
 */
export function createMockBaseRepositoryMethods() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getById: vi.fn() as any,
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
