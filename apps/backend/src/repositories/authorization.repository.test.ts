import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';

describe('AuthorizationRepository', () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();
  const mockExecute = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
    execute: mockExecute,
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

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('should return empty map when given empty array', async () => {
      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([]);

      expect(result).toEqual(new Map());
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return counts map for single administration', async () => {
      mockExecute.mockResolvedValue({
        rows: [{ administration_id: 'admin-1', assigned_count: 25 }],
      });

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([
        '550e8400-e29b-41d4-a716-446655440000',
      ]);

      expect(result.get('admin-1')).toBe(25);
      expect(result.size).toBe(1);
    });

    it('should return counts map for multiple administrations', async () => {
      mockExecute.mockResolvedValue({
        rows: [
          { administration_id: 'admin-1', assigned_count: 25 },
          { administration_id: 'admin-2', assigned_count: 50 },
          { administration_id: 'admin-3', assigned_count: 10 },
        ],
      });

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ]);

      expect(result.size).toBe(3);
      expect(result.get('admin-1')).toBe(25);
      expect(result.get('admin-2')).toBe(50);
      expect(result.get('admin-3')).toBe(10);
    });

    it('should not include administrations with no assigned users', async () => {
      mockExecute.mockResolvedValue({
        rows: [{ administration_id: 'admin-1', assigned_count: 15 }],
      });

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]);

      expect(result.size).toBe(1);
      expect(result.has('admin-1')).toBe(true);
      expect(result.has('admin-2')).toBe(false);
    });

    it('should return empty map when no administrations have assigned users', async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const repository = new AuthorizationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds([
        '550e8400-e29b-41d4-a716-446655440000',
      ]);

      expect(result.size).toBe(0);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      mockExecute.mockRejectedValue(dbError);

      const repository = new AuthorizationRepository(mockDb);

      await expect(
        repository.getAssignedUserCountsByAdministrationIds(['550e8400-e29b-41d4-a716-446655440000']),
      ).rejects.toThrow('Connection refused');
    });

    it('should throw error for invalid UUID format', async () => {
      const repository = new AuthorizationRepository(mockDb);

      await expect(repository.getAssignedUserCountsByAdministrationIds(['not-a-valid-uuid'])).rejects.toThrow(
        'Invalid UUID format',
      );
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should throw error if any UUID in array is invalid', async () => {
      const repository = new AuthorizationRepository(mockDb);

      await expect(
        repository.getAssignedUserCountsByAdministrationIds([
          '550e8400-e29b-41d4-a716-446655440000',
          'invalid-uuid',
          '550e8400-e29b-41d4-a716-446655440001',
        ]),
      ).rejects.toThrow('Invalid UUID format');
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
