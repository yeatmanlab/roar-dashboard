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
    // Create a chainable subquery mock that supports many unions + as
    const createUnionSubquery = (maxDepth = 9) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createUnionChain = (depth = 0): any => {
        const result = {
          union: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'accessible_admins.administrationId',
          }),
        };
        if (depth < maxDepth) {
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
    const createInnerJoinChain = (maxUnionDepth = 9) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        innerJoin: vi.fn(),
        where: vi.fn().mockReturnValue(createUnionSubquery(maxUnionDepth)),
      };
      chain.innerJoin.mockReturnValue(chain);
      return chain;
    };

    // Setup mock for the UNION subquery building
    const setupUnionSubqueryMocks = (maxUnionDepth = 9) => {
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue(createInnerJoinChain(maxUnionDepth)),
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
      // Supervisory roles (like administrator) build 10 subqueries (6 base + 4 look-down)
      let selectCallCount = 0;
      const mockCountResult = [{ count: 2 }];
      const mockDataResult = [
        { administration: { id: 'admin-1', name: 'Admin 1' } },
        { administration: { id: 'admin-2', name: 'Admin 2' } },
      ];

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // First 10 calls are for building the UNION subquery (supervisory role)
        if (selectCallCount <= 10) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain()) };
        }
        // 11th call is for count query
        if (selectCallCount === 11) {
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
      // Supervisory roles build 10 subqueries
      let selectCallCount = 0;

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 10) {
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
      // Supervisory roles build 10 subqueries
      let selectCallCount = 0;
      const mockOffsetFn = vi.fn().mockResolvedValue([]);

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 10) {
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

    it('should build 6 access path subqueries for non-supervisory roles (student)', async () => {
      setupUnionSubqueryMocks(5);

      // Setup count to return 0 so we don't need to mock data query
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // Student role only builds 6 subqueries (no look-down paths)
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain(5)) };
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
        { userId: 'user-123', allowedRoles: ['student' as UserRole] },
        { page: 1, perPage: 10 },
      );

      // 6 subquery selects + 1 count select = 7 total (no look-down paths for student)
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });

    it('should build 10 access path subqueries for supervisory roles (administrator)', async () => {
      setupUnionSubqueryMocks();

      // Setup count to return 0 so we don't need to mock data query
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // Supervisory roles build 10 subqueries (6 base + 4 look-down)
        if (selectCallCount <= 10) {
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

      // 10 subquery selects + 1 count select = 11 total (includes look-down paths)
      expect(mockSelect).toHaveBeenCalledTimes(11);
    });

    it('should build 10 access path subqueries for teacher role', async () => {
      setupUnionSubqueryMocks();

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 10) {
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
        { userId: 'user-123', allowedRoles: ['teacher' as UserRole] },
        { page: 1, perPage: 10 },
      );

      // 10 subquery selects + 1 count select = 11 total (teacher is supervisory)
      expect(mockSelect).toHaveBeenCalledTimes(11);
    });

    it('should build 6 access path subqueries for guardian role', async () => {
      setupUnionSubqueryMocks(5);

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return { from: vi.fn().mockReturnValue(createInnerJoinChain(5)) };
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
        { userId: 'user-123', allowedRoles: ['guardian' as UserRole] },
        { page: 1, perPage: 10 },
      );

      // 6 subquery selects + 1 count select = 7 total (guardian is not supervisory)
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');

      // Supervisory roles build 10 subqueries
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 10) {
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

    it('should build 10 subqueries when mixed roles include at least one supervisory role', async () => {
      setupUnionSubqueryMocks();

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 10) {
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
        { userId: 'user-123', allowedRoles: ['student' as UserRole, 'teacher' as UserRole] },
        { page: 1, perPage: 10 },
      );

      // When roles include a supervisory role (teacher), all 10 paths are built
      expect(mockSelect).toHaveBeenCalledTimes(11);
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    const mockGroupBy = vi.fn();

    // Setup mock for aggregation query: db.select().from(assignments).groupBy()
    const setupAggregationMock = (resolvedValue: { administrationId: string; assignedCount: number }[]) => {
      mockGroupBy.mockResolvedValue(resolvedValue);

      // Override mockSelect to handle both subquery selects and aggregation select
      let selectCallCount = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createUnionAllChain = (depth = 0): any => {
        const result = {
          unionAll: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'assignments.administrationId',
            userId: 'assignments.userId',
          }),
        };
        if (depth < 5) {
          result.unionAll.mockReturnValue(createUnionAllChain(depth + 1));
        }
        return result;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createInnerJoinChain = (): any => {
        const chain = {
          innerJoin: vi.fn(),
          where: vi.fn().mockReturnValue(createUnionAllChain(0)),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chain.innerJoin as any).mockReturnValue(chain);
        return chain;
      };

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // First 6 calls are for building the UNION ALL subquery
        if (selectCallCount <= 6) {
          return {
            from: vi.fn().mockReturnValue(createInnerJoinChain()),
          };
        }
        // 7th call is for aggregation select
        return {
          from: vi.fn().mockReturnValue({
            groupBy: mockGroupBy,
          }),
        };
      });
    };

    it('should return empty map when given empty array', async () => {
      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([]);

      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should return counts map for single administration', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 25 }]);

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      expect(result.get('admin-1')).toBe(25);
      expect(result.size).toBe(1);
    });

    it('should return counts map for multiple administrations', async () => {
      setupAggregationMock([
        { administrationId: 'admin-1', assignedCount: 25 },
        { administrationId: 'admin-2', assignedCount: 50 },
        { administrationId: 'admin-3', assignedCount: 10 },
      ]);

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2', 'admin-3']);

      expect(result.size).toBe(3);
      expect(result.get('admin-1')).toBe(25);
      expect(result.get('admin-2')).toBe(50);
      expect(result.get('admin-3')).toBe(10);
    });

    it('should not include administrations with no assigned users', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 15 }]);

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2']);

      expect(result.size).toBe(1);
      expect(result.has('admin-1')).toBe(true);
      expect(result.has('admin-2')).toBe(false);
    });

    it('should return empty map when no administrations have assigned users', async () => {
      setupAggregationMock([]);

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      expect(result.size).toBe(0);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');

      let selectCallCount = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createUnionAllChain = (depth = 0): any => {
        const result = {
          unionAll: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'assignments.administrationId',
            userId: 'assignments.userId',
          }),
        };
        if (depth < 5) {
          result.unionAll.mockReturnValue(createUnionAllChain(depth + 1));
        }
        return result;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createInnerJoinChain = (): any => {
        const chain = {
          innerJoin: vi.fn(),
          where: vi.fn().mockReturnValue(createUnionAllChain(0)),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chain.innerJoin as any).mockReturnValue(chain);
        return chain;
      };

      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          return {
            from: vi.fn().mockReturnValue(createInnerJoinChain()),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockRejectedValue(dbError),
          }),
        };
      });

      const repository = new AdministrationRepository(mockDb);

      await expect(repository.getAssignedUserCountsByAdministrationIds(['admin-1'])).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should build queries for all six access paths (org hierarchy + direct memberships)', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 10 }]);

      const repository = new AdministrationRepository(mockDb);
      await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      // 6 subquery selects + 1 aggregation select = 7 total
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });
  });
});
