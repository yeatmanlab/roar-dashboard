import { vi } from 'vitest';

/**
 * Helper that returns mocked versions of all BaseRepository methods and properties.
 * Use this to avoid repeating these in every repository mock.
 */
export function createMockBaseRepositoryMethods() {
  return {
    // Base class properties (mocked as undefined since they're not directly accessed in unit tests)
    typedTable: undefined as unknown,
    db: undefined as unknown,
    table: undefined as unknown,
    // Protected methods (mocked for completeness)
    calculateOffset: vi.fn(),
    buildOrderClause: vi.fn(),
    // Public methods
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
