import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-dashboard/api-contract';
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
