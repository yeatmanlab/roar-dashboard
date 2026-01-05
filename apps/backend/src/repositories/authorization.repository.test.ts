import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';

describe('AuthorizationRepository', () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup select chain for subqueries: db.select().from().innerJoin().where()
    const createSelectChain = () => ({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
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
});
