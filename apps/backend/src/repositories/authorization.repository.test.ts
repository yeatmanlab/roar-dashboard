import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';

describe('AuthorizationRepository', () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();
  const mockGroupBy = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a chainable subquery mock that supports unionAll
    const createSubqueryWithUnion = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subquery: any = {
        unionAll: vi.fn(),
        as: vi.fn(),
      };

      // unionAll returns another subquery that also supports unionAll and as
      subquery.unionAll.mockReturnValue({
        unionAll: vi.fn().mockReturnValue({
          as: vi.fn().mockReturnValue({
            administrationId: 'assignments.administrationId',
            userId: 'assignments.userId',
          }),
        }),
        as: vi.fn().mockReturnValue({
          administrationId: 'assignments.administrationId',
          userId: 'assignments.userId',
        }),
      });

      return subquery;
    };

    // Setup select chain for subqueries: db.select().from().innerJoin().where()
    const createSelectChain = () => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(createSubqueryWithUnion()),
        }),
      }),
    });

    mockSelect.mockImplementation(() => createSelectChain());

    // Setup selectDistinct chain: db.selectDistinct().from()
    mockSelectDistinct.mockReturnValue({
      from: mockFrom,
    });
  });

  describe('getAccessibleAdministrationIds', () => {
    it('should return administration IDs accessible via org membership', async () => {
      const expectedIds = ['admin-1', 'admin-2'];
      mockFrom.mockResolvedValue(expectedIds.map((id) => ({ administrationId: id })));

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAccessibleAdministrationIds('user-123');

      expect(result).toEqual(expectedIds);
      expect(mockSelect).toHaveBeenCalledTimes(3); // viaOrgs, viaClasses, viaGroups
      expect(mockSelectDistinct).toHaveBeenCalled();
    });

    it('should return empty array when user has no accessible administrations', async () => {
      mockFrom.mockResolvedValue([]);

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAccessibleAdministrationIds('user-no-access');

      expect(result).toEqual([]);
    });

    it('should deduplicate administration IDs from multiple sources', async () => {
      // Simulating UNION ALL + DISTINCT - the DB returns deduplicated results
      const deduplicatedIds = ['admin-1', 'admin-2', 'admin-3'];
      mockFrom.mockResolvedValue(deduplicatedIds.map((id) => ({ administrationId: id })));

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAccessibleAdministrationIds('user-multi-membership');

      expect(result).toEqual(deduplicatedIds);
    });

    it('should handle single administration access', async () => {
      mockFrom.mockResolvedValue([{ administrationId: 'single-admin' }]);

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAccessibleAdministrationIds('user-single');

      expect(result).toEqual(['single-admin']);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      mockFrom.mockRejectedValue(dbError);

      const repository = new AuthorizationRepository(mockDb);

      await expect(repository.getAccessibleAdministrationIds('user-123')).rejects.toThrow('Connection refused');
    });

    it('should query all three membership types (orgs, classes, groups)', async () => {
      mockFrom.mockResolvedValue([]);

      const repository = new AuthorizationRepository(mockDb);
      await repository.getAccessibleAdministrationIds('user-123');

      // Verify three select queries were built (one for each membership type)
      expect(mockSelect).toHaveBeenCalledTimes(3);
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    // Setup mock for aggregation query: db.select().from(assignments).groupBy()
    const setupAggregationMock = (resolvedValue: { administrationId: string; assignedCount: number }[]) => {
      mockGroupBy.mockResolvedValue(resolvedValue);

      // Override mockSelect to handle both subquery selects and aggregation select
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        // First 3 calls are for viaOrgs, viaClasses, viaGroups subqueries
        if (selectCallCount <= 3) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subquery: any = {
            unionAll: vi.fn(),
            as: vi.fn(),
          };
          subquery.unionAll.mockReturnValue({
            unionAll: vi.fn().mockReturnValue({
              as: vi.fn().mockReturnValue({
                administrationId: 'assignments.administrationId',
                userId: 'assignments.userId',
              }),
            }),
          });

          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(subquery),
              }),
            }),
          };
        }
        // 4th call is for aggregation: db.select({...}).from(assignments).groupBy()
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
        if (selectCallCount <= 3) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subquery: any = { unionAll: vi.fn() };
          subquery.unionAll.mockReturnValue({
            unionAll: vi.fn().mockReturnValue({
              as: vi.fn().mockReturnValue({
                administrationId: 'assignments.administrationId',
                userId: 'assignments.userId',
              }),
            }),
          });
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(subquery),
              }),
            }),
          };
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

    it('should build queries for all three membership types (orgs, classes, groups)', async () => {
      setupAggregationMock([{ administrationId: 'admin-1', assignedCount: 10 }]);

      const repository = new AuthorizationRepository(mockDb);
      await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      // 3 subquery selects + 1 aggregation select = 4 total
      expect(mockSelect).toHaveBeenCalledTimes(4);
    });
  });
});
