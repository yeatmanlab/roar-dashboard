import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationRepository } from './administration.repository';
import { AuthorizationRepository } from './authorization.repository';
import type { UserRole } from '../enums/user-role.enum';

// Mock AuthorizationRepository
vi.mock('./authorization.repository', () => ({
  AuthorizationRepository: vi.fn(),
}));

describe('AdministrationRepository', () => {
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb: any = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
  };

  // Mock AuthorizationRepository instance
  const mockAuthRepository = {
    buildAccessibleAdministrationIdsQuery: vi.fn(),
    getAssignedUserCountsByAdministrationIds: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    vi.mocked(AuthorizationRepository).mockImplementation(
      () => mockAuthRepository as unknown as AuthorizationRepository,
    );
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
    // Setup mock for the accessible admins subquery
    const setupAccessibleAdminsMock = () => {
      mockAuthRepository.buildAccessibleAdministrationIdsQuery.mockReturnValue({
        as: vi.fn().mockReturnValue({
          administrationId: 'accessible_admins.administrationId',
        }),
      });
    };

    it('should return empty result when allowedRoles is empty', async () => {
      const repository = new AdministrationRepository(mockDb);
      const result = await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: [] },
        { page: 1, perPage: 10 },
      );

      expect(result).toEqual({ items: [], totalItems: 0 });
      expect(mockAuthRepository.buildAccessibleAdministrationIdsQuery).not.toHaveBeenCalled();
    });

    it('should call AuthorizationRepository.buildAccessibleAdministrationIdsQuery with correct params', async () => {
      setupAccessibleAdminsMock();

      // Mock count query to return 0 to avoid needing data query mock
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      }));

      const repository = new AdministrationRepository(mockDb);
      await repository.listAuthorized(
        { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
        { page: 1, perPage: 10 },
      );

      expect(mockAuthRepository.buildAccessibleAdministrationIdsQuery).toHaveBeenCalledWith({
        userId: 'user-123',
        allowedRoles: ['administrator'],
      });
    });

    it('should execute count and data queries for authorized user', async () => {
      setupAccessibleAdminsMock();

      const mockCountResult = [{ count: 2 }];
      const mockDataResult = [
        { administration: { id: 'admin-1', name: 'Admin 1' } },
        { administration: { id: 'admin-2', name: 'Admin 2' } },
      ];

      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCountResult),
          }),
        }),
      }));

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
      setupAccessibleAdminsMock();

      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      }));

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
      setupAccessibleAdminsMock();

      const mockOffsetFn = vi.fn().mockResolvedValue([]);

      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 50 }]),
          }),
        }),
      }));

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

    it('should propagate database errors', async () => {
      setupAccessibleAdminsMock();

      const dbError = new Error('Connection refused');
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      }));

      const repository = new AdministrationRepository(mockDb);

      await expect(
        repository.listAuthorized(
          { userId: 'user-123', allowedRoles: ['administrator' as UserRole] },
          { page: 1, perPage: 10 },
        ),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('should delegate to AuthorizationRepository', async () => {
      const expectedResult = new Map([
        ['admin-1', 25],
        ['admin-2', 50],
      ]);
      mockAuthRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(expectedResult);

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1', 'admin-2']);

      expect(mockAuthRepository.getAssignedUserCountsByAdministrationIds).toHaveBeenCalledWith(['admin-1', 'admin-2']);
      expect(result).toEqual(expectedResult);
    });

    it('should return empty map when AuthorizationRepository returns empty map', async () => {
      mockAuthRepository.getAssignedUserCountsByAdministrationIds.mockResolvedValue(new Map());

      const repository = new AdministrationRepository(mockDb);
      const result = await repository.getAssignedUserCountsByAdministrationIds(['admin-1']);

      expect(result.size).toBe(0);
    });

    it('should propagate errors from AuthorizationRepository', async () => {
      const dbError = new Error('Connection refused');
      mockAuthRepository.getAssignedUserCountsByAdministrationIds.mockRejectedValue(dbError);

      const repository = new AdministrationRepository(mockDb);

      await expect(repository.getAssignedUserCountsByAdministrationIds(['admin-1'])).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
