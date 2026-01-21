import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationRepository } from './administration.repository';
import type { UserRole } from '../enums/user-role.enum';

describe('AdministrationRepository', () => {
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildStatusFilter', () => {
    it('should return undefined when status is undefined', () => {
      const repository = new AdministrationRepository(mockDb);
      const result = repository.buildStatusFilter(undefined);

      expect(result).toBeUndefined();
    });

    it('should return SQL condition for active status', () => {
      const repository = new AdministrationRepository(mockDb);
      const result = repository.buildStatusFilter('active');

      // The result should be a SQL condition (not undefined)
      expect(result).toBeDefined();
      // Drizzle SQL objects have a queryChunks property
      expect(result).toHaveProperty('queryChunks');
    });

    it('should return SQL condition for past status', () => {
      const repository = new AdministrationRepository(mockDb);
      const result = repository.buildStatusFilter('past');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('queryChunks');
    });

    it('should return SQL condition for upcoming status', () => {
      const repository = new AdministrationRepository(mockDb);
      const result = repository.buildStatusFilter('upcoming');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('queryChunks');
    });

    it('should return undefined for unknown status value', () => {
      const repository = new AdministrationRepository(mockDb);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = repository.buildStatusFilter('invalid' as any);

      expect(result).toBeUndefined();
    });
  });

  describe('listAuthorized', () => {
    // Create a chainable subquery mock that supports 5 unions + as
    const createUnionSubquery = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createUnionChain = (depth = 0): any => {
        const result = {
          union: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'accessible_admins.administrationId',
          }),
        };
        if (depth < 5) {
          result.union.mockReturnValue(createUnionChain(depth + 1));
        }
        return result;
      };

      const subquery = {
        union: vi.fn().mockReturnValue(createUnionChain(1)),
      };
      return subquery;
    };

    // Create chainable innerJoin mock
    const createInnerJoinChain = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        innerJoin: vi.fn(),
        where: vi.fn().mockReturnValue(createUnionSubquery()),
      };
      chain.innerJoin.mockReturnValue(chain);
      return chain;
    };

    // Setup mock for the UNION subquery building (6 select calls)
    const setupUnionSubqueryMocks = () => {
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue(createInnerJoinChain()),
      }));
    };

    it('should return empty result when allowedRoles is empty', async () => {
      const repository = new AdministrationRepository(mockDb);
      const result = await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: [] },
        { page: 1, perPage: 10 },
      );

      expect(result).toEqual({ items: [], totalItems: 0 });
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should execute count and data queries for authorized user', async () => {
      // Setup mocks for the full query flow
      let selectCallCount = 0;
      const mockCountResult = [{ count: 2 }];
      const mockDataResult = [
        { administration: { id: 'admin-1', name: 'Admin 1' } },
        { administration: { id: 'admin-2', name: 'Admin 2' } },
      ];

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // First 6 calls are for building the UNION subquery
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        // 7th call is for count query
        if (selectCallCount === 7) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockCountResult),
              }),
            }),
          };
        }
        return { from: vi.fn() };
      });

      mockSelectDistinct.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockDataResult),
                }),
              }),
            }),
          }),
        }),
      }));

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
        { page: 1, perPage: 10 },
      );

      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ id: 'admin-1', name: 'Admin 1' });
    });

    it('should return empty items when count is 0', async () => {
      let selectCallCount = 0;

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        // Count query returns 0
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          }),
        };
      });

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
        { page: 1, perPage: 10 },
      );

      expect(result).toEqual({ items: [], totalItems: 0 });
      // selectDistinct should not be called when count is 0
      expect(mockSelectDistinct).not.toHaveBeenCalled();
    });

    it('should apply pagination offset correctly', async () => {
      let selectCallCount = 0;
      const mockOffsetFn = vi.fn().mockResolvedValue([]);

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 50 }]),
            }),
          }),
        };
      });

      mockSelectDistinct.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: mockOffsetFn,
                }),
              }),
            }),
          }),
        }),
      }));

      const repository = new AdministrationRepository(mockDb);
      await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
        { page: 3, perPage: 10 },
      );

      // Page 3 with perPage 10: offset = (3-1) * 10 = 20
      expect(mockOffsetFn).toHaveBeenCalledWith(20);
    });

    it('should build 6 access path subqueries for UNION', async () => {
      setupUnionSubqueryMocks();

      // Setup count to return 0 so we don't need to mock data query
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          }),
        };
      });

      const repository = new AdministrationRepository(mockDb);
      await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
        { page: 1, perPage: 10 },
      );

      // 6 subquery selects + 1 count select = 7 total
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(dbError),
            }),
          }),
        };
      });

      const repository = new AdministrationRepository(mockDb);

      await expect(
        repository.listAuthorized(
          { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
          { page: 1, perPage: 10 },
        ),
      ).rejects.toThrow('Connection refused');
    });
  });
});
