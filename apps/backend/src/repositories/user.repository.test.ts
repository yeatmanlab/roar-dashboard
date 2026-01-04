import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from './user.repository';
import { UserFactory } from '../test-support/factories/user.factory';

describe('UserRepository', () => {
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

  describe('findByAuthId', () => {
    it('should return user when found by authId', async () => {
      const mockUser = UserFactory.build({ authId: 'firebase-uid-123' });
      mockLimit.mockResolvedValue([mockUser]);

      const repository = new UserRepository(mockDb);
      const result = await repository.findByAuthId('firebase-uid-123');

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockLimit.mockResolvedValue([]);

      const repository = new UserRepository(mockDb);
      const result = await repository.findByAuthId('non-existent-uid');

      expect(result).toBeNull();
    });
  });

  describe('get', () => {
    it('should return user when found by id', async () => {
      const mockUser = UserFactory.build();
      mockLimit.mockResolvedValue([mockUser]);

      const repository = new UserRepository(mockDb);
      const result = await repository.get({ id: mockUser.id });

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by id', async () => {
      mockLimit.mockResolvedValue([]);

      const repository = new UserRepository(mockDb);
      const result = await repository.get({ id: 'non-existent-id' });

      expect(result).toBeNull();
    });

    it('should return users when queried with where clause', async () => {
      const mockUsers = [UserFactory.build(), UserFactory.build()];
      const mockDynamicWhere = vi.fn().mockReturnThis();
      const dynamicQuery = {
        where: mockDynamicWhere,
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve(mockUsers),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.get({ where: mockWhereClause });

      expect(mockDynamicWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(result).toEqual(mockUsers);
    });

    it('should apply limit when provided with where clause', async () => {
      const mockUsers = [UserFactory.build()];
      const mockDynamicWhere = vi.fn().mockReturnThis();
      const mockDynamicLimit = vi.fn().mockReturnThis();
      const dynamicQuery = {
        where: mockDynamicWhere,
        limit: mockDynamicLimit,
        then: (resolve: (value: unknown) => void) => resolve(mockUsers),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.get({ where: mockWhereClause, limit: 1 });

      expect(mockDynamicLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUsers);
    });

    it('should return null when no id or where provided', async () => {
      const repository = new UserRepository(mockDb);
      const result = await repository.get({});

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [UserFactory.build(), UserFactory.build()];

      // First call: count query returns total
      const mockCountQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 10 }]),
        [Symbol.toStringTag]: 'Promise',
      };

      // Second call: items query returns users
      const mockItemsQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve(mockUsers),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new UserRepository(mockDb);
      const result = await repository.getAll({ page: 1, perPage: 2 });

      expect(result.items).toEqual(mockUsers);
      expect(result.totalItems).toBe(10);
    });

    it('should apply where clause to both count and items queries', async () => {
      const mockUsers = [UserFactory.build()];
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
        then: (resolve: (value: unknown) => void) => resolve(mockUsers),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = { test: true };
      const result = await repository.getAll({ page: 1, perPage: 10, where: mockWhereClause });

      expect(mockCountWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(mockItemsWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(result.totalItems).toBe(5);
    });

    it('should calculate correct offset for pagination', async () => {
      const mockUsers = [UserFactory.build()];
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
        then: (resolve: (value: unknown) => void) => resolve(mockUsers),
        [Symbol.toStringTag]: 'Promise',
      };

      mockDynamic.mockReturnValueOnce(mockCountQuery).mockReturnValueOnce(mockItemsQuery);

      const repository = new UserRepository(mockDb);
      await repository.getAll({ page: 3, perPage: 25 });

      // Page 3 with 25 per page = offset of (3-1) * 25 = 50
      expect(mockOffsetFn).toHaveBeenCalledWith(50);
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const mockUser = UserFactory.build();
      mockReturning.mockResolvedValue([mockUser]);

      const repository = new UserRepository(mockDb);
      const result = await repository.create({ data: mockUser });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error when create fails', async () => {
      mockReturning.mockResolvedValue([]);

      const repository = new UserRepository(mockDb);

      await expect(repository.create({ data: {} })).rejects.toThrow('Failed to create entity');
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new UserRepository(mockDb);
      await repository.update({ id: 'user-id', data: { nameFirst: 'Updated' } });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ nameFirst: 'Updated' });
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new UserRepository(mockDb);
      await repository.delete({ id: 'user-id' });

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('runTransaction', () => {
    it('should execute function within transaction', async () => {
      const mockResult = { success: true };
      const mockTx = {};
      mockTransaction.mockImplementation(async (fn) => fn(mockTx));

      const repository = new UserRepository(mockDb);
      const result = await repository.runTransaction({
        fn: async (tx) => {
          expect(tx).toBe(mockTx);
          return mockResult;
        },
      });

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('count', () => {
    it('should return count of users', async () => {
      // Create a dynamic query that resolves to count result
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([{ count: 5 }]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new UserRepository(mockDb);
      const result = await repository.count({});

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should apply where clause when provided', async () => {
      const mockDynamicWhere = vi.fn().mockReturnThis();
      const dynamicQuery = {
        where: mockDynamicWhere,
        then: (resolve: (value: unknown) => void) => resolve([{ count: 2 }]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.count({ where: mockWhereClause });

      expect(mockDynamicWhere).toHaveBeenCalledWith(mockWhereClause);
      expect(result).toBe(2);
    });

    it('should return 0 when no results', async () => {
      const dynamicQuery = {
        where: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => resolve([]),
        [Symbol.toStringTag]: 'Promise',
      };
      mockDynamic.mockReturnValue(dynamicQuery);

      const repository = new UserRepository(mockDb);
      const result = await repository.count({});

      expect(result).toBe(0);
    });
  });
});
