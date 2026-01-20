import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunsRepository } from './runs.repository';

describe('RunsRepository', () => {
  const mockGroupBy = vi.fn();
  const mockWhere = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup select chain: db.select().from().where().groupBy()
    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockWhere.mockReturnValue({
      groupBy: mockGroupBy,
    });
  });

  describe('getRunStatsByAdministrationIds', () => {
    it('should return empty map when given empty array', async () => {
      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds([]);

      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should return stats map for single administration', async () => {
      mockGroupBy.mockResolvedValue([{ administrationId: 'admin-1', started: 10, completed: 5 }]);

      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds(['admin-1']);

      expect(result.get('admin-1')).toEqual({ started: 10, completed: 5 });
      expect(result.size).toBe(1);
    });

    it('should return stats map for multiple administrations', async () => {
      mockGroupBy.mockResolvedValue([
        { administrationId: 'admin-1', started: 10, completed: 5 },
        { administrationId: 'admin-2', started: 20, completed: 15 },
        { administrationId: 'admin-3', started: 8, completed: 0 },
      ]);

      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds(['admin-1', 'admin-2', 'admin-3']);

      expect(result.size).toBe(3);
      expect(result.get('admin-1')).toEqual({ started: 10, completed: 5 });
      expect(result.get('admin-2')).toEqual({ started: 20, completed: 15 });
      expect(result.get('admin-3')).toEqual({ started: 8, completed: 0 });
    });

    it('should not include administrations with no runs in the result', async () => {
      // Database only returns rows for administrations that have runs
      mockGroupBy.mockResolvedValue([{ administrationId: 'admin-1', started: 5, completed: 2 }]);

      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds(['admin-1', 'admin-2']);

      expect(result.size).toBe(1);
      expect(result.has('admin-1')).toBe(true);
      expect(result.has('admin-2')).toBe(false);
    });

    it('should return empty map when no administrations have runs', async () => {
      mockGroupBy.mockResolvedValue([]);

      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds(['admin-1', 'admin-2']);

      expect(result.size).toBe(0);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      mockGroupBy.mockRejectedValue(dbError);

      const repository = new RunsRepository(mockDb);

      await expect(repository.getRunStatsByAdministrationIds(['admin-1'])).rejects.toThrow('Connection refused');
    });

    it('should handle zero completed counts correctly', async () => {
      mockGroupBy.mockResolvedValue([{ administrationId: 'admin-1', started: 100, completed: 0 }]);

      const repository = new RunsRepository(mockDb);
      const result = await repository.getRunStatsByAdministrationIds(['admin-1']);

      expect(result.get('admin-1')).toEqual({ started: 100, completed: 0 });
    });
  });
});
