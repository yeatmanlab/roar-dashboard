import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationAccessControls } from './administration.access-controls';
import type { UserRole } from '../../enums/user-role.enum';

// Expected path counts for authorization queries
// Ancestor only: org→org, class→org, direct class, direct group
const EXPECTED_PATHS_NON_SUPERVISORY = 4;
// Ancestor + descendant: base 4 + org→descendant org, org→descendant class
const EXPECTED_PATHS_SUPERVISORY = 6;
// User assignments: org→org users, org→class users, direct class, direct group
const EXPECTED_PATHS_USER_ASSIGNMENTS = 4;

describe('AdministrationAccessControls', () => {
  const mockSelect = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create chainable union mock for building UNION queries
  const createUnionChain = (maxDepth = 5) => {
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
  const createInnerJoinChain = (maxUnionDepth = 5) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      innerJoin: vi.fn(),
      where: vi.fn().mockReturnValue(createUnionChain(maxUnionDepth)),
    };
    chain.innerJoin.mockReturnValue(chain);
    return chain;
  };

  // Setup mock for UNION subquery building
  const setupUnionMocks = (maxUnionDepth = 5) => {
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue(createInnerJoinChain(maxUnionDepth)),
    }));
  };

  describe('buildUserAdministrationIdsQuery', () => {
    it('should build ancestor-only paths for non-supervisory roles (student)', () => {
      setupUnionMocks(EXPECTED_PATHS_NON_SUPERVISORY - 1);

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['student' as UserRole],
      });

      // Student role only builds ancestor paths (no descendant access)
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_NON_SUPERVISORY);
    });

    it('should build ancestor and descendant paths for supervisory roles (administrator)', () => {
      setupUnionMocks();

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['administrator' as UserRole],
      });

      // Administrator builds all paths (ancestor + descendant)
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_SUPERVISORY);
    });

    it('should build ancestor and descendant paths for teacher role', () => {
      setupUnionMocks();

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['teacher' as UserRole],
      });

      // Teacher is supervisory, builds all paths
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_SUPERVISORY);
    });

    it('should build ancestor-only paths for guardian role', () => {
      setupUnionMocks(EXPECTED_PATHS_NON_SUPERVISORY - 1);

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['guardian' as UserRole],
      });

      // Guardian is not supervisory, builds ancestor paths only
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_NON_SUPERVISORY);
    });

    it('should build all paths when mixed roles include at least one supervisory role', () => {
      setupUnionMocks();

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['student' as UserRole, 'teacher' as UserRole],
      });

      // When roles include a supervisory role (teacher), all paths are built
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_SUPERVISORY);
    });

    it('should return a query object with union and as methods', () => {
      setupUnionMocks();

      const accessControls = new AdministrationAccessControls(mockDb);
      const result = accessControls.buildUserAdministrationIdsQuery({
        userId: 'user-123',
        allowedRoles: ['administrator' as UserRole],
      });

      // Result should be chainable (have union and as methods from the mock)
      expect(result).toBeDefined();
    });
  });

  describe('buildAdministrationUserAssignmentsQuery', () => {
    // Helper to create chainable unionAll mock
    const createUnionAllChain = (maxDepth = 3) => {
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

    it('should build all user assignment paths', () => {
      setupAssignmentsMocks();

      const accessControls = new AdministrationAccessControls(mockDb);
      accessControls.buildAdministrationUserAssignmentsQuery(['admin-1', 'admin-2']);

      // Builds paths using ltree for hierarchy traversal
      expect(mockSelect).toHaveBeenCalledTimes(EXPECTED_PATHS_USER_ASSIGNMENTS);
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
        if (depth < 3) {
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
        // First 4 calls are for building the UNION ALL subquery
        if (selectCallCount <= 4) {
          return {
            from: vi.fn().mockReturnValue(createInnerJoinChain()),
          };
        }
        // 5th call is for aggregation select
        return {
          from: vi.fn().mockReturnValue({
            groupBy: mockGroupBy,
          }),
        };
      });
    };

    it('should return empty map when given empty array', async () => {
      const accessControls = new AdministrationAccessControls(mockDb);
      const result = await accessControls.getAssignedUserCountsByAdministrationIds([]);

      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should return counts map for single administration', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 25 }]);

      const accessControls = new AdministrationAccessControls(mockDb);
      const result = await accessControls.getAssignedUserCountsByAdministrationIds(['admin-1']);

      expect(result.get('admin-1')).toBe(25);
      expect(result.size).toBe(1);
    });

    it('should return counts map for multiple administrations', async () => {
      setupAggregationMock([
        { administrationId: 'admin-1', assignedCount: 25 },
        { administrationId: 'admin-2', assignedCount: 50 },
        { administrationId: 'admin-3', assignedCount: 10 },
      ]);

      const accessControls = new AdministrationAccessControls(mockDb);
      const result = await accessControls.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2', 'admin-3']);

      expect(result.size).toBe(3);
      expect(result.get('admin-1')).toBe(25);
      expect(result.get('admin-2')).toBe(50);
      expect(result.get('admin-3')).toBe(10);
    });

    it('should not include administrations with no assigned users', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 15 }]);

      const accessControls = new AdministrationAccessControls(mockDb);
      const result = await accessControls.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2']);

      expect(result.size).toBe(1);
      expect(result.has('admin-1')).toBe(true);
      expect(result.has('admin-2')).toBe(false);
    });

    it('should return empty map when no administrations have assigned users', async () => {
      setupAggregationMock([]);

      const accessControls = new AdministrationAccessControls(mockDb);
      const result = await accessControls.getAssignedUserCountsByAdministrationIds(['admin-1']);

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
        if (depth < 3) {
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
        if (selectCallCount <= 4) {
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

      const accessControls = new AdministrationAccessControls(mockDb);

      await expect(accessControls.getAssignedUserCountsByAdministrationIds(['admin-1'])).rejects.toThrow(
        'Connection refused',
      );
    });

    it('should build queries for all four access paths', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 10 }]);

      const accessControls = new AdministrationAccessControls(mockDb);
      await accessControls.getAssignedUserCountsByAdministrationIds(['admin-1']);

      // 4 subquery selects + 1 aggregation select = 5 total
      expect(mockSelect).toHaveBeenCalledTimes(5);
    });
  });
});
