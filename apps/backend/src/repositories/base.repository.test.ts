import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository } from './base.repository';
import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Concrete implementation of BaseRepository for testing.
 * Since BaseRepository is abstract, we need a concrete class to test it.
 */
interface TestEntity extends Record<string, unknown> {
  id: string;
  name: string;
  createdAt: Date;
}

class TestRepository extends BaseRepository<TestEntity, PgTable> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any, table: any) {
    super(db, table);
  }
}

describe('BaseRepository', () => {
  // Mock query chain methods
  const mockLimit = vi.fn();
  const mockWhere = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockDelete = vi.fn();
  const mockTransaction = vi.fn();
  const mockDynamic = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    transaction: mockTransaction,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTable: any = {
    id: { name: 'id' },
    name: { name: 'name' },
    createdAt: { name: 'created_at' },
  };

  const createTestEntity = (overrides: Partial<TestEntity> = {}): TestEntity => ({
    id: `test-id-${Math.random().toString(36).substring(7)}`,
    name: 'Test Entity',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a dynamic query builder that allows chaining
    const createDynamicQuery = (resolvedValue: unknown) => {
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve(resolvedValue),
        [Symbol.toStringTag]: 'Promise',
      };
      return dynamicQuery;
    };

    // Setup select chain: db.select().from().$dynamic() or db.select().from().where().limit()
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
      $dynamic: mockDynamic,
    });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockDynamic.mockImplementation(() => createDynamicQuery([]));

    // Setup insert chain: db.insert().values().returning()
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    // Setup update chain: db.update().set().where()
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });

    // Setup delete chain: db.delete().where()
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe('get', () => {
    describe('by id', () => {
      it('should return entity when found by id', async () => {
        const mockEntity = createTestEntity({ id: 'entity-123' });
        mockLimit.mockResolvedValue([mockEntity]);

        const repository = new TestRepository(mockDb, mockTable);
        const result = await repository.get({ id: 'entity-123' });

        expect(mockSelect).toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalledWith(mockTable);
        expect(result).toEqual(mockEntity);
      });

      it('should return null when entity not found by id', async () => {
        mockLimit.mockResolvedValue([]);

        const repository = new TestRepository(mockDb, mockTable);
        const result = await repository.get({ id: 'non-existent-id' });

        expect(result).toBeNull();
      });
    });

    describe('by where clause', () => {
      it('should return entities when queried with where clause', async () => {
        const mockEntities = [createTestEntity(), createTestEntity()];
        const mockDynamicWhere = vi.fn().mockReturnThis();
        const dynamicQuery = {
          where: mockDynamicWhere,
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => void) => resolve(mockEntities),
          [Symbol.toStringTag]: 'Promise',
        };
        mockDynamic.mockReturnValue(dynamicQuery);

        const repository = new TestRepository(mockDb, mockTable);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockWhereClause: any = { field: 'value' };
        const result = await repository.get({ where: mockWhereClause });

        expect(mockDynamicWhere).toHaveBeenCalledWith(mockWhereClause);
        expect(result).toEqual(mockEntities);
      });

      it('should apply limit when provided with where clause', async () => {
        const mockEntities = [createTestEntity()];
        const mockDynamicLimit = vi.fn().mockReturnThis();
        const dynamicQuery = {
          where: vi.fn().mockReturnThis(),
          limit: mockDynamicLimit,
          then: (resolve: (value: unknown) => void) => resolve(mockEntities),
          [Symbol.toStringTag]: 'Promise',
        };
        mockDynamic.mockReturnValue(dynamicQuery);

        const repository = new TestRepository(mockDb, mockTable);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await repository.get({ where: {} as any, limit: 5 });

        expect(mockDynamicLimit).toHaveBeenCalledWith(5);
        expect(result).toEqual(mockEntities);
      });
    });

    describe('without id or where', () => {
      it('should return null when neither id nor where is provided', async () => {
        const repository = new TestRepository(mockDb, mockTable);
        const result = await repository.get({});

        expect(mockSelect).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe('getAll', () => {
    it('should return paginated results', async () => {
      const mockEntities = [createTestEntity(), createTestEntity()];

      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 50 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve(mockEntities),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.getAll({ page: 1, perPage: 10 });

      expect(result.items).toEqual(mockEntities);
      expect(result.totalItems).toBe(50);
    });

    it('should apply where clause to both count and items queries', async () => {
      const mockCountWhere = vi.fn().mockReturnThis();
      const mockItemsWhere = vi.fn().mockReturnThis();

      const mockCountQuery = {
        where: mockCountWhere,
        then: (resolve: (value: unknown) => void) => resolve([{ count: 5 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: mockItemsWhere,
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = { active: true };
      await repository.getAll({ page: 1, perPage: 10, where: mockWhereClause });

      expect(mockCountWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(mockItemsWhere).toHaveBeenCalledWith(mockWhereClause);
    });

    it('should calculate correct offset for page 1', async () => {
      const mockOffsetFn = vi.fn().mockReturnThis();

      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 100 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: mockOffsetFn,
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.getAll({ page: 1, perPage: 25 });

      // Page 1: offset = (1-1) * 25 = 0
      expect(mockOffsetFn).toHaveBeenCalledWith(0);
    });

    it('should calculate correct offset for subsequent pages', async () => {
      const mockOffsetFn = vi.fn().mockReturnThis();

      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 100 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: mockOffsetFn,
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.getAll({ page: 4, perPage: 15 });

      // Page 4: offset = (4-1) * 15 = 45
      expect(mockOffsetFn).toHaveBeenCalledWith(45);
    });

    it('should apply orderBy with ascending direction', async () => {
      const mockOrderByFn = vi.fn().mockReturnThis();

      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 10 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: mockOrderByFn,
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.getAll({
        page: 1,
        perPage: 10,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(mockOrderByFn).toHaveBeenCalled();
    });

    it('should apply orderBy with descending direction', async () => {
      const mockOrderByFn = vi.fn().mockReturnThis();

      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 10 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: mockOrderByFn,
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.getAll({
        page: 1,
        perPage: 10,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      expect(mockOrderByFn).toHaveBeenCalled();
    });

    it('should return 0 totalItems when count result is empty', async () => {
      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.getAll({ page: 1, perPage: 10 });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create and return a new entity', async () => {
      const mockEntity = createTestEntity();
      mockReturning.mockResolvedValue([mockEntity]);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.create({ data: mockEntity });

      expect(mockInsert).toHaveBeenCalledWith(mockTable);
      expect(mockValues).toHaveBeenCalledWith(mockEntity);
      expect(mockReturning).toHaveBeenCalled();
      expect(result).toEqual(mockEntity);
    });

    it('should throw error when create returns no entity', async () => {
      mockReturning.mockResolvedValue([]);

      const repository = new TestRepository(mockDb, mockTable);

      await expect(repository.create({ data: {} })).rejects.toThrow('Failed to create entity');
    });

    it('should throw error when create returns undefined', async () => {
      mockReturning.mockResolvedValue([undefined]);

      const repository = new TestRepository(mockDb, mockTable);

      await expect(repository.create({ data: {} })).rejects.toThrow('Failed to create entity');
    });
  });

  describe('update', () => {
    it('should update an entity by id', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.update({ id: 'entity-123', data: { name: 'Updated Name' } });

      expect(mockUpdate).toHaveBeenCalledWith(mockTable);
      expect(mockSet).toHaveBeenCalledWith({ name: 'Updated Name' });
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new TestRepository(mockDb, mockTable);
      const updateData = { name: 'New Name', createdAt: new Date('2024-06-01') };
      await repository.update({ id: 'entity-456', data: updateData });

      expect(mockSet).toHaveBeenCalledWith(updateData);
    });
  });

  describe('delete', () => {
    it('should delete an entity by id', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new TestRepository(mockDb, mockTable);
      await repository.delete({ id: 'entity-to-delete' });

      expect(mockDelete).toHaveBeenCalledWith(mockTable);
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('runTransaction', () => {
    it('should execute function within transaction context', async () => {
      const mockResult = { success: true, data: 'transaction result' };
      const mockTx = { id: 'mock-transaction' };
      mockTransaction.mockImplementation(async (fn) => fn(mockTx));

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.runTransaction({
        fn: async (tx) => {
          expect(tx).toBe(mockTx);
          return mockResult;
        },
      });

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from transaction function', async () => {
      const transactionError = new Error('Transaction failed');
      mockTransaction.mockImplementation(async (fn) => fn({}));

      const repository = new TestRepository(mockDb, mockTable);

      await expect(
        repository.runTransaction({
          fn: async () => {
            throw transactionError;
          },
        }),
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('count', () => {
    it('should return count of entities', async () => {
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 42 }]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.count({});

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('should apply where clause when provided', async () => {
      const mockDynamicWhere = vi.fn().mockReturnThis();
      const dynamicQuery = {
        where: mockDynamicWhere,
        then: (resolve: (value: unknown) => void) => resolve([{ count: 7 }]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new TestRepository(mockDb, mockTable);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = { status: 'active' };
      const result = await repository.count({ where: mockWhereClause });

      expect(mockDynamicWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(result).toBe(7);
    });

    it('should return 0 when count result is empty array', async () => {
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.count({});

      expect(result).toBe(0);
    });

    it('should return 0 when count result is undefined', async () => {
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([undefined]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new TestRepository(mockDb, mockTable);
      const result = await repository.count({});

      expect(result).toBe(0);
    });
  });
});
