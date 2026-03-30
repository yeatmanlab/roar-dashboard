import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-dashboard/api-contract';
import { GroupService } from './group.service';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { UserRole } from '../../enums/user-role.enum';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { EnrolledUserFactory } from '../../test-support/factories/user.factory';
import { createMockGroupRepository } from '../../test-support/repositories';

describe('GroupService', () => {
  let mockGroupRepository: ReturnType<typeof createMockGroupRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupRepository = createMockGroupRepository();
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

    it('should check authorization for non-super admin users with supervisory role', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.TEACHER]);
      mockGroupRepository.getAuthorizedUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'group-123', defaultOptions);

      expect(mockGroupRepository.getById).toHaveBeenCalledWith({ id: 'group-123' });
      expect(mockGroupRepository.getAuthorizedById).toHaveBeenCalled();
      expect(mockGroupRepository.getUserRolesForGroup).toHaveBeenCalledWith('user-123', 'group-123');
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should allow administrator role to list users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      const mockUsers = EnrolledUserFactory.buildList(5);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.ADMINISTRATOR]);
      mockGroupRepository.getAuthorizedUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 5,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      const result = await service.listUsers(
        { userId: 'admin-user-123', isSuperAdmin: false },
        'group-123',
        defaultOptions,
      );

      expect(result.items).toHaveLength(5);
    });

    it('should allow site_administrator role to list users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      const mockUsers = EnrolledUserFactory.buildList(4);
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.SITE_ADMINISTRATOR]);
      mockGroupRepository.getAuthorizedUsersByGroupId.mockResolvedValue({
        items: mockUsers,
        totalItems: 4,
      });

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      const result = await service.listUsers(
        { userId: 'site-admin-123', isSuperAdmin: false },
        'group-123',
        defaultOptions,
      );

      expect(result.items).toHaveLength(4);
    });

    it('should return empty results when group has no users', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUsersByGroupId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'group-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when group does not exist', async () => {
      mockGroupRepository.getById.mockResolvedValue(null);

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when non-super admin has no access to existing group', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(null);

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw forbidden error when user has no supervisory role', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.STUDENT]);

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: 'user-123', groupId: 'group-123', userRoles: [UserRole.STUDENT] },
      });
    });

    it('should throw forbidden error for caregiver roles (guardian/parent/relative) - supervised not supervisory', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      mockGroupRepository.getAuthorizedById.mockResolvedValue(mockGroup);
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.GUARDIAN]);

      const service = GroupService({
        groupRepository: mockGroupRepository,
      });

      await expect(
        service.listUsers({ userId: 'caregiver-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: 'caregiver-123', groupId: 'group-123', userRoles: [UserRole.GUARDIAN] },
      });

      // Also verify parent and relative roles are rejected
      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.PARENT]);
      await expect(
        service.listUsers({ userId: 'parent-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: 'parent-123', groupId: 'group-123', userRoles: [UserRole.PARENT] },
      });

      mockGroupRepository.getUserRolesForGroup.mockResolvedValue([UserRole.RELATIVE]);
      await expect(
        service.listUsers({ userId: 'relative-123', isSuperAdmin: false }, 'group-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: 'relative-123', groupId: 'group-123', userRoles: [UserRole.RELATIVE] },
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockGroup = GroupFactory.build({ id: 'group-123' });
      mockGroupRepository.getById.mockResolvedValue(mockGroup);
      const dbError = new Error('Connection refused');
      mockGroupRepository.getUsersByGroupId.mockRejectedValue(dbError);

      const service = GroupService({
        groupRepository: mockGroupRepository,
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
});
