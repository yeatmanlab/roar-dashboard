import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from './user.repository';

// Mock the database client so instantiation never touches a real pool
vi.mock('../db/clients', () => ({
  CoreDbClient: {},
}));

describe('UserRepository', () => {
  describe('findByAuthId', () => {
    let mockDb: {
      select: ReturnType<typeof vi.fn>;
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    let repository: UserRepository;

    beforeEach(() => {
      vi.clearAllMocks();

      mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      // @ts-expect-error - Using mock db for testing
      repository = new UserRepository(mockDb);
    });

    // Pins the blank-authId invariant: the guard must reject before the query is
    // built, so a blank value can never reach the WHERE clause against the
    // nullable unique authId column.
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
    ])('throws without querying when authId is %s', async (_label, authId) => {
      await expect(repository.findByAuthId(authId as never)).rejects.toThrow(
        'findByAuthId requires a non-empty authId',
      );

      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('queries the database for a non-empty authId', async () => {
      const result = await repository.findByAuthId('firebase-uid');

      expect(mockDb.select).toHaveBeenCalledOnce();
      expect(result).toBeNull();
    });
  });
});
