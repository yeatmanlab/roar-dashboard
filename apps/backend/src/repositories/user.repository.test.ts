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

    // Setup select chain: db.select().from().where().limit()
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, limit: mockLimit });
    mockWhere.mockReturnValue({ limit: mockLimit });

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
      mockWhere.mockResolvedValue(mockUsers);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.get({ where: mockWhereClause });

      expect(result).toEqual(mockUsers);
    });

    it('should apply limit when provided with where clause', async () => {
      const mockUsers = [UserFactory.build()];
      mockLimit.mockResolvedValue(mockUsers);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.get({ where: mockWhereClause, limit: 1 });

      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUsers);
    });

    it('should return null when no id or where provided', async () => {
      const repository = new UserRepository(mockDb);
      const result = await repository.get({});

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all users', async () => {
      const mockUsers = [UserFactory.build(), UserFactory.build()];
      mockFrom.mockResolvedValue(mockUsers);

      const repository = new UserRepository(mockDb);
      const result = await repository.getAll({});

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should apply where clause when provided', async () => {
      const mockUsers = [UserFactory.build()];
      mockWhere.mockResolvedValue(mockUsers);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.getAll({ where: mockWhereClause });

      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should apply limit when provided', async () => {
      const mockUsers = [UserFactory.build()];
      mockLimit.mockResolvedValue(mockUsers);

      const repository = new UserRepository(mockDb);
      const result = await repository.getAll({ limit: 10 });

      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockUsers);
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

      await expect(repository.create({ data: {} })).rejects.toThrow('Failed to create user');
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new UserRepository(mockDb);
      await repository.update({ id: 'user-id', data: { name_first: 'Updated' } });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ name_first: 'Updated' });
    });
  });

  describe('updateIfChanged', () => {
    it('should call update', async () => {
      mockWhere.mockResolvedValue(undefined);

      const repository = new UserRepository(mockDb);
      await repository.updateIfChanged({ id: 'user-id', data: { name_first: 'Updated' } });

      expect(mockUpdate).toHaveBeenCalled();
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
      mockFrom.mockResolvedValue([{ count: 5 }]);

      const repository = new UserRepository(mockDb);
      const result = await repository.count({});

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should apply where clause when provided', async () => {
      mockWhere.mockResolvedValue([{ count: 2 }]);

      const repository = new UserRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockWhereClause: any = {};
      const result = await repository.count({ where: mockWhereClause });

      expect(mockWhere).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should return 0 when no results', async () => {
      mockFrom.mockResolvedValue([]);

      const repository = new UserRepository(mockDb);
      const result = await repository.count({});

      expect(result).toBe(0);
    });
  });
});
