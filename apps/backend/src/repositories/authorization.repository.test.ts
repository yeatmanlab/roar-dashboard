import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';
import type { UserRole } from '../enums/user-role.enum';

describe('AuthorizationRepository', () => {
  const mockSelect = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create chainable union mock for building UNION queries
  const createUnionChain = (maxDepth = 9) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createChain = (depth = 0): any => {
      const result = {
        union: vi.fn(),
        as: vi.fn().mockReturnValue({
          administrationId: 'accessible_admins.administrationId',
        }),
      };
      if (depth < maxDepth) {
        result.union.mockReturnValue(createChain(depth + 1));
      }
      return result;
    };
    return createChain(0);
  };

  // Helper to create chainable innerJoin mock
  const createInnerJoinChain = (maxUnionDepth = 9) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      innerJoin: vi.fn(),
      where: vi.fn().mockReturnValue(createUnionChain(maxUnionDepth)),
    };
    chain.innerJoin.mockReturnValue(chain);
    return chain;
  };

  // Setup mock for UNION subquery building
  const setupUnionMocks = (maxUnionDepth = 9) => {
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue(createInnerJoinChain(maxUnionDepth)),
    }));
  };

  describe('buildAccessibleAdministrationIdsQuery', () => {
    it('should build 6 access path subqueries for non-supervisory roles (student)', () => {
      setupUnionMocks(5);

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['student' as UserRole],
      });

      // Student role only builds 6 subqueries (no look-down paths)
      expect(mockSelect).toHaveBeenCalledTimes(6);
    });

    it('should build 10 access path subqueries for supervisory roles (administrator)', () => {
      setupUnionMocks();

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['administrator' as UserRole],
      });

      // Administrator builds 10 subqueries (6 base + 4 look-down)
      expect(mockSelect).toHaveBeenCalledTimes(10);
    });

    it('should build 10 access path subqueries for teacher role', () => {
      setupUnionMocks();

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['teacher' as UserRole],
      });

      // Teacher is supervisory, builds 10 subqueries
      expect(mockSelect).toHaveBeenCalledTimes(10);
    });

    it('should build 6 access path subqueries for guardian role', () => {
      setupUnionMocks(5);

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['guardian' as UserRole],
      });

      // Guardian is not supervisory, builds 6 subqueries
      expect(mockSelect).toHaveBeenCalledTimes(6);
    });

    it('should build 10 subqueries when mixed roles include at least one supervisory role', () => {
      setupUnionMocks();

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['student' as UserRole, 'teacher' as UserRole],
      });

      // When roles include a supervisory role (teacher), all 10 paths are built
      expect(mockSelect).toHaveBeenCalledTimes(10);
    });

    it('should return a query object with union and as methods', () => {
      setupUnionMocks();

      const repository = new AuthorizationRepository(mockDb);
      const result = repository.buildAccessibleAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['administrator' as UserRole],
      });

      // Result should be chainable (have union and as methods from the mock)
      expect(result).toBeDefined();
    });
  });

  describe('buildAdministrationUserAssignmentsQuery', () => {
    // Helper to create chainable unionAll mock
    const createUnionAllChain = (maxDepth = 5) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createChain = (depth = 0): any => {
        const result = {
          unionAll: vi.fn(),
          as: vi.fn().mockReturnValue({
            administrationId: 'assignments.administrationId',
            userId: 'assignments.userId',
          }),
        };
        if (depth < maxDepth) {
          result.unionAll.mockReturnValue(createChain(depth + 1));
        }
        return result;
      };
      return createChain(0);
    };

    const createInnerJoinChainForAssignments = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        innerJoin: vi.fn(),
        where: vi.fn().mockReturnValue(createUnionAllChain()),
      };
      chain.innerJoin.mockReturnValue(chain);
      return chain;
    };

    const setupAssignmentsMocks = () => {
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue(createInnerJoinChainForAssignments()),
      }));
    };

    it('should build 6 access path subqueries for user assignments', () => {
      setupAssignmentsMocks();

      const repository = new AuthorizationRepository(mockDb);
      repository.buildAdministrationUserAssignmentsQuery(['admin-1', 'admin-2']);

      // Always builds 6 paths (no supervisory distinction for user assignments)
      expect(mockSelect).toHaveBeenCalledTimes(6);
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    const mockGroupBy = vi.fn();

    const setupAggregationMock = (resolvedValue: { administrationId: string; assignedCount: number }[]) => {
      mockGroupBy.mockResolvedValue(resolvedValue);

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

      const repository = new AuthorizationRepository(mockDb);

      await expect(repository.getAssignedUserCountsByAdministrationIds(['admin-1'])).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should build queries for all six access paths', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 10 }]);

      const repository = new AuthorizationRepository(mockDb);
      await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      // 6 subquery selects + 1 aggregation select = 7 total
      expect(mockSelect).toHaveBeenCalledTimes(7);
    });
  });
});
