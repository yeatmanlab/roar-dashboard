import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdministrationService } from './administration.service';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { ResourceScopeType } from '../../enums/resource-scope-type.enum';

describe('AdministrationService', () => {
  const mockGetByIds = vi.fn();
  const mockGetAll = vi.fn();
  const mockGetAdministrationsScope = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdministrationRepository: any = {
    getByIds: mockGetByIds,
    getAll: mockGetAll,
  };

  const mockAuthorizationService = {
    getAdministrationsScope: mockGetAdministrationsScope,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return all administrations when scope is unrestricted (admin users)', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      mockGetAdministrationsScope.mockResolvedValue({ type: ResourceScopeType.UNRESTRICTED });
      mockGetAll.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'admin-123', userType: 'admin' },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockGetAdministrationsScope).toHaveBeenCalledWith('admin-123', 'admin');
      expect(mockGetAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should fetch by scoped IDs for non-admin users', async () => {
      const mockAdmins = AdministrationFactory.buildList(3);
      const accessibleIds = ['id-1', 'id-2', 'id-3'];

      mockGetAdministrationsScope.mockResolvedValue({
        type: ResourceScopeType.SCOPED,
        ids: accessibleIds,
      });
      mockGetByIds.mockResolvedValue({
        items: mockAdmins,
        totalItems: 3,
      });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'user-123', userType: 'educator' },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockGetAdministrationsScope).toHaveBeenCalledWith('user-123', 'educator');
      expect(mockGetByIds).toHaveBeenCalledWith(accessibleIds, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should pass pagination options to repository', async () => {
      mockGetAdministrationsScope.mockResolvedValue({
        type: ResourceScopeType.SCOPED,
        ids: ['id-1'],
      });
      mockGetByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'user-456', userType: 'educator' },
        {
          page: 3,
          perPage: 50,
          sortBy: 'dateStart',
          sortOrder: 'asc',
        },
      );

      expect(mockGetByIds).toHaveBeenCalledWith(['id-1'], {
        page: 3,
        perPage: 50,
        orderBy: { field: 'dateStart', direction: 'asc' },
      });
    });

    it('should return empty results when user has no accessible administrations', async () => {
      mockGetAdministrationsScope.mockResolvedValue({
        type: ResourceScopeType.SCOPED,
        ids: [],
      });
      mockGetByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'user-no-access', userType: 'student' },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockGetByIds).toHaveBeenCalledWith([], expect.any(Object));
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should map API sort field "name" to database column "nameInternal"', async () => {
      mockGetAdministrationsScope.mockResolvedValue({
        type: ResourceScopeType.SCOPED,
        ids: ['id-1'],
      });
      mockGetByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = AdministrationService({
        administrationRepository: mockAdministrationRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'user-123', userType: 'educator' },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockGetByIds).toHaveBeenCalledWith(['id-1'], {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameInternal', direction: 'asc' },
      });
    });
  });
});
