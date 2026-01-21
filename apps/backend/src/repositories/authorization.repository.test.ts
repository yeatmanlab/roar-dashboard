import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';

describe('AuthorizationRepository', () => {
  const mockSelect = vi.fn();
  const mockGroupBy = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a chainable subquery mock that supports union (UNION removes duplicates)
    const createSubqueryWithUnion = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subquery: any = {
        union: vi.fn(),
        unionAll: vi.fn(),
        as: vi.fn(),
      };

      // Create a deeply nested mock that supports chaining 6 union calls + as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createUnionResult = (depth = 0): any => {
        const result = {
          union: vi.fn(),
          unionAll: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'accessible.administrationId',
            userId: 'assignments.userId',
          }),
        };
        if (depth < 6) {
          result.union.mockReturnValue(createUnionResult(depth + 1));
          result.unionAll.mockReturnValue(createUnionResult(depth + 1));
        }
        return result;
      };

      subquery.union.mockReturnValue(createUnionResult(1));
      subquery.unionAll.mockReturnValue(createUnionResult(1));

      return subquery;
    };

    // Create chainable innerJoin mock that supports arbitrary depth
    const createInnerJoinChain = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        innerJoin: vi.fn(),
        where: vi.fn().mockReturnValue(createSubqueryWithUnion()),
      };
      // innerJoin returns another chain that can also innerJoin or where
      chain.innerJoin.mockReturnValue(chain);
      return chain;
    };

    // Setup select chain for subqueries: db.select().from().innerJoin()...
    const createSelectChain = () => ({
      from: vi.fn().mockReturnValue(createInnerJoinChain()),
    });

    mockSelect.mockImplementation(() => createSelectChain());
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    // Setup mock for aggregation query: db.select().from(assignments).groupBy()
    const setupAggregationMock = (resolvedValue: { administrationId: string; assignedCount: number }[]) => {
      mockGroupBy.mockResolvedValue(resolvedValue);

      // Override mockSelect to handle both subquery selects and aggregation select
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // First 6 calls are for the 6 access path subqueries
        if (selectCallCount <= 6) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const createChain = (): any => {
            const chain = { innerJoin: vi.fn(), where: vi.fn() };
            chain.innerJoin.mockReturnValue(chain);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subquery: any = { unionAll: vi.fn(), as: vi.fn() };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const createUnionAllChain = (depth = 0): any => {
              const result = {
                unionAll: vi.fn(),
                as: vi.fn().mockReturnValue({
                  administrationId: 'assignments.administrationId',
                  userId: 'assignments.userId',
                }),
              };
              if (depth < 6) result.unionAll.mockReturnValue(createUnionAllChain(depth + 1));
              return result;
            };
            subquery.unionAll.mockReturnValue(createUnionAllChain(1));
            chain.where.mockReturnValue(subquery);
            return chain;
          };
          return { from: vi.fn().mockReturnValue(createChain()) };
        }
        // 7th call is for aggregation: db.select({...}).from(assignments).groupBy()
        return {
          from: vi.fn().mockReturnValue({
            groupBy: mockGroupBy,
          }),
        };
      });
    };

    it('should return empty map when given empty array', async () => {
      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([]);

      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should return counts map for single administration', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 25 }]);

      const repository = new AuthorizationRepository(mockDb);
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

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2', 'admin-3']);

      expect(result.size).toBe(3);
      expect(result.get('admin-1')).toBe(25);
      expect(result.get('admin-2')).toBe(50);
      expect(result.get('admin-3')).toBe(10);
    });

    it('should not include administrations with no assigned users', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 15 }]);

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2']);

      expect(result.size).toBe(1);
      expect(result.has('admin-1')).toBe(true);
      expect(result.has('admin-2')).toBe(false);
    });

    it('should return empty map when no administrations have assigned users', async () => {
      setupAggregationMock([]);

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      expect(result.size).toBe(0);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      mockGroupBy.mockRejectedValue(dbError);

      // Setup mocks for the subquery chain
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount <= 6) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const createChain = (): any => {
            const chain = { innerJoin: vi.fn(), where: vi.fn() };
            chain.innerJoin.mockReturnValue(chain);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const subquery: any = { unionAll: vi.fn() };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const createUnionAllChain = (d = 0): any => {
              const r = {
                unionAll: vi.fn(),
                as: vi.fn().mockReturnValue({
                  administrationId: 'assignments.administrationId',
                  userId: 'assignments.userId',
                }),
              };
              if (d < 6) r.unionAll.mockReturnValue(createUnionAllChain(d + 1));
              return r;
            };
            subquery.unionAll.mockReturnValue(createUnionAllChain(1));
            chain.where.mockReturnValue(subquery);
            return chain;
          };
          return { from: vi.fn().mockReturnValue(createChain()) };
        }
        return {
          from: vi.fn().mockReturnValue({
            groupBy: mockGroupBy,
          }),
        };
      });

      const repository = new AuthorizationRepository(mockDb);

      await expect(repository.getAssignedUserCountsByAdministrationIds(['admin-1'])).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should build queries for all six access paths (org hierarchy + direct memberships)', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 10 }]);

      const repository = new AuthorizationRepository(mockDb);
      await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      // 6 subquery selects + 1 aggregation select = 7 total
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });
  });
});
