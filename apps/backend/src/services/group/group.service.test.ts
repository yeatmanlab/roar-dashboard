import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-platform/api-contract';
import { GroupService } from './group.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { EnrolledUserFactory } from '../../test-support/factories/user.factory';
import { createMockGroupRepository } from '../../test-support/repositories';
import type { MockGroupRepository } from '../../test-support/repositories';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { MockAuthorizationService } from '../../test-support/services';

describe('GroupService', () => {
  let mockGroupRepository: MockGroupRepository;
  let mockAuthorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGroupRepository = createMockGroupRepository();
    mockAuthorizationService = createMockAuthorizationService();
  });

  describe('listUsers', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
      embed: [] as 'demographics'[],
    };

    it('should return users for super admin (unrestricted)', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', defaultOptions);

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockGroupRepository.getUsersByGroupId).toHaveBeenCalledWith('group-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        embedDemographics: false,
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should return users for group with rosteringEnded != null for super admin (unrestricted)', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123', rosteringEnded: new Date() });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', defaultOptions);

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockGroupRepository.getUsersByGroupId).toHaveBeenCalledWith('group-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        embedDemographics: false,
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check FGA can_list_users for non-super admin users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'group-123', defaultOptions);

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.GROUP}:group-123`,
      );
      expect(mockGroupRepository.getUsersByGroupId).toHaveBeenCalledWith('group-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        embedDemographics: false,
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when group has no users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when group does not exist', async () => {
      mockGroupRepository.getById.mockResolvedValue(null);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when FGA denies can_list_users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      const dbError = new Error('Connection refused');
      mockGroupRepository.getUsersByGroupId.mockRejectedValue(dbError);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Failed to retrieve group users',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should pass embedDemographics=true to the repository when the demographics embed is requested', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', {
        ...defaultOptions,
        embed: ['demographics'],
      });

      expect(mockGroupRepository.getUsersByGroupId).toHaveBeenCalledWith('group-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        embedDemographics: true,
      });
    });
  });

  describe('list', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: SortOrder.DESC,
    };

    it('should return all groups for super admins (unrestricted)', async () => {
      const mockGroups = GroupFactory.buildList(3);
      mockGroupRepository.listAll.mockResolvedValue({ items: mockGroups, totalItems: 3 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list({ userId: 'admin-123', isSuperAdmin: true }, defaultOptions);

      expect(mockGroupRepository.listAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.DESC },
        includeEnded: false,
      });
      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use FGA listAccessibleObjects + listByIds for non-super admin users', async () => {
      const mockGroups = GroupFactory.buildList(2);

      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([
        `${FgaType.GROUP}:${mockGroups[0]!.id}`,
        `${FgaType.GROUP}:${mockGroups[1]!.id}`,
      ]);
      mockGroupRepository.listByIds.mockResolvedValue({ items: mockGroups, totalItems: 2 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        { ...defaultOptions, sortOrder: SortOrder.ASC },
      );

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST,
        FgaType.GROUP,
      );
      expect(mockGroupRepository.listByIds).toHaveBeenCalledWith([mockGroups[0]!.id, mockGroups[1]!.id], {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.ASC },
        includeEnded: false,
      });
      expect(mockGroupRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should short-circuit to an empty result when the user can access no groups', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([]);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list({ userId: 'user-123', isSuperAdmin: false }, defaultOptions);

      expect(result).toEqual({ items: [], totalItems: 0 });
      expect(mockGroupRepository.listByIds).not.toHaveBeenCalled();
      expect(mockGroupRepository.listAll).not.toHaveBeenCalled();
    });

    it('should forward includeEnded to the repository', async () => {
      mockGroupRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list({ userId: 'admin-123', isSuperAdmin: true }, { ...defaultOptions, includeEnded: true });

      expect(mockGroupRepository.listAll).toHaveBeenCalledWith(expect.objectContaining({ includeEnded: true }));
    });

    it('should wrap unexpected repository errors in a 500 ApiError', async () => {
      const dbError = new Error('Connection refused');
      mockGroupRepository.listAll.mockRejectedValue(dbError);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.list({ userId: 'admin-123', isSuperAdmin: true }, defaultOptions)).rejects.toMatchObject({
        message: 'Failed to retrieve groups',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('getById', () => {
    const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
    const mockSuperAdminContext = { userId: 'admin-123', isSuperAdmin: true };

    it('should fetch a group by ID for regular users via FGA can_read', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById(mockAuthContext, 'group-123');

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_READ,
        `${FgaType.GROUP}:group-123`,
      );
      expect(result).toEqual(mockGroup);
    });

    it('should bypass the FGA check for super admins', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById(mockSuperAdminContext, 'group-123');

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(result).toEqual(mockGroup);
    });

    it('should throw 404 when the group does not exist', async () => {
      mockGroupRepository.getById.mockResolvedValue(null);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, 'missing-group')).rejects.toMatchObject({
        message: ApiErrorMessage.NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      // Existence check precedes the FGA call — a missing group is a 404, not a 403.
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should throw 403 when FGA denies can_read', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, 'group-123')).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should wrap unexpected repository errors in a 500 ApiError', async () => {
      const dbError = new Error('Connection refused');
      mockGroupRepository.getById.mockRejectedValue(dbError);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, 'group-123')).rejects.toMatchObject({
        message: 'Failed to retrieve group',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('create', () => {
    const validInput = {
      name: 'Pilot Cohort',
      abbreviation: 'PC1',
      groupType: 'cohort' as const,
    };
    const superAdminContext = { userId: 'admin-123', isSuperAdmin: true };
    const userContext = { userId: 'user-123', isSuperAdmin: false };

    it('should create a group for super admins and return the new id', async () => {
      mockGroupRepository.createGroup.mockResolvedValue({ id: 'group-new-1' });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.create(superAdminContext, validInput);

      expect(result).toEqual({ id: 'group-new-1' });
      expect(mockGroupRepository.createGroup).toHaveBeenCalledWith({
        name: 'Pilot Cohort',
        abbreviation: 'PC1',
        groupType: 'cohort',
      });
    });

    it('should flatten nested location into the repository input', async () => {
      mockGroupRepository.createGroup.mockResolvedValue({ id: 'group-new-2' });

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.create(superAdminContext, {
        ...validInput,
        location: {
          addressLine1: '1 Research Way',
          city: 'Palo Alto',
          stateProvince: 'CA',
          postalCode: '94305',
          country: 'US',
        },
      });

      expect(mockGroupRepository.createGroup).toHaveBeenCalledWith({
        name: 'Pilot Cohort',
        abbreviation: 'PC1',
        groupType: 'cohort',
        locationAddressLine1: '1 Research Way',
        locationCity: 'Palo Alto',
        locationStateProvince: 'CA',
        locationPostalCode: '94305',
        locationCountry: 'US',
      });
    });

    it('should throw 403 when caller is not a super admin and never call the repo', async () => {
      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.create(userContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      expect(mockGroupRepository.createGroup).not.toHaveBeenCalled();
    });

    it('should re-throw an ApiError thrown by the repository unchanged', async () => {
      const repoError = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockGroupRepository.createGroup.mockRejectedValue(repoError);

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toBe(repoError);
    });

    it('should wrap unexpected DB errors as ApiError 500 with DATABASE_QUERY_FAILED', async () => {
      mockGroupRepository.createGroup.mockRejectedValue(new Error('connection lost'));

      const service = GroupService({
        groupRepository: mockGroupRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });
});
