import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-dashboard/api-contract';
import { ClassService } from './class.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { EnrolledUserFactory } from '../../test-support/factories/user.factory';
import { createMockClassRepository, createMockSchoolRepository } from '../../test-support/repositories';
import type { MockClassRepository, MockSchoolRepository } from '../../test-support/repositories';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { ClassType } from '../../enums/class-type.enum';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { MockAuthorizationService } from '../../test-support/services';

describe('ClassService', () => {
  let mockClassRepository: MockClassRepository;
  let mockAuthorizationService: MockAuthorizationService;
  let mockSchoolRepository: MockSchoolRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClassRepository = createMockClassRepository();
    mockAuthorizationService = createMockAuthorizationService();
    mockSchoolRepository = createMockSchoolRepository();
  });

  describe('listUsers', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
    };

    it('should return users for super admin (unrestricted)', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should return users for class with rosteringEnded != null for super admin (unrestricted)', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123', rosteringEnded: new Date() });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check FGA can_list_users for non-super admin users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.CLASS}:class-123`,
      );
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when class has no users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when class does not exist', async () => {
      mockClassRepository.getById.mockResolvedValue(null);

      const service = ClassService({
        classRepository: mockClassRepository,
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
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      const dbError = new Error('Connection refused');
      mockClassRepository.getUsersByClassId.mockRejectedValue(dbError);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Failed to retrieve class users',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });

  describe('create', () => {
    const districtId = '11111111-1111-4111-8111-111111111111';
    const schoolId = '22222222-2222-4222-8222-222222222222';
    const validInput = {
      schoolId,
      name: 'Reading 101',
      classType: ClassType.HOMEROOM,
    };
    const superAdminContext = { userId: 'admin-123', isSuperAdmin: true };
    const userContext = { userId: 'user-123', isSuperAdmin: false };

    function buildActiveSchool() {
      return OrgFactory.build({
        id: schoolId,
        orgType: OrgType.SCHOOL,
        parentOrgId: districtId,
        rosteringEnded: null,
      });
    }

    it('should create a class for super admins, deriving districtId from the school', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(buildActiveSchool());
      mockClassRepository.createClass.mockResolvedValue({ id: 'class-new-1' });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.create(superAdminContext, validInput);

      expect(result).toEqual({ id: 'class-new-1' });
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(schoolId);
      expect(mockClassRepository.createClass).toHaveBeenCalledWith({
        schoolId,
        districtId,
        name: 'Reading 101',
        classType: ClassType.HOMEROOM,
      });
    });

    it('should pass through optional fields including grades and subjects', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(buildActiveSchool());
      mockClassRepository.createClass.mockResolvedValue({ id: 'class-new-2' });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await service.create(superAdminContext, {
        ...validInput,
        number: '101A',
        period: '3',
        termId: '33333333-3333-4333-8333-333333333333',
        courseId: '44444444-4444-4444-8444-444444444444',
        subjects: ['Reading', 'Phonics'],
        grades: ['3', '4'],
        location: 'Room 12',
      });

      expect(mockClassRepository.createClass).toHaveBeenCalledWith({
        schoolId,
        districtId,
        name: 'Reading 101',
        classType: ClassType.HOMEROOM,
        number: '101A',
        period: '3',
        termId: '33333333-3333-4333-8333-333333333333',
        courseId: '44444444-4444-4444-8444-444444444444',
        subjects: ['Reading', 'Phonics'],
        grades: ['3', '4'],
        location: 'Room 12',
      });
    });

    it('should throw 403 when caller is not a super admin and never call the repos', async () => {
      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(userContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      expect(mockSchoolRepository.getUnrestrictedById).not.toHaveBeenCalled();
      expect(mockClassRepository.createClass).not.toHaveBeenCalled();
    });

    it('should throw 422 when schoolId does not resolve to any row', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      });
      expect(mockClassRepository.createClass).not.toHaveBeenCalled();
    });

    it('should throw 422 when the parent has the wrong orgType (district passed as school)', async () => {
      // SchoolRepository.getUnrestrictedById filters by orgType=school and
      // returns null when the row is a district. Belt-and-suspenders: if
      // that filter ever changes, the service still rejects with 422.
      const wrongTypeRow = OrgFactory.build({
        id: schoolId,
        orgType: OrgType.DISTRICT,
        rosteringEnded: null,
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(wrongTypeRow);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      });
      expect(mockClassRepository.createClass).not.toHaveBeenCalled();
    });

    it('should throw 422 when the parent school has rosteringEnded in the past', async () => {
      const endedSchool = OrgFactory.build({
        id: schoolId,
        orgType: OrgType.SCHOOL,
        parentOrgId: districtId,
        rosteringEnded: new Date('2020-01-01T00:00:00.000Z'),
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(endedSchool);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      });
      expect(mockClassRepository.createClass).not.toHaveBeenCalled();
    });

    it('should throw 500 when the parent school has a null parentOrgId (data integrity violation)', async () => {
      const orphanSchool = OrgFactory.build({
        id: schoolId,
        orgType: OrgType.SCHOOL,
        parentOrgId: null,
        rosteringEnded: null,
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(orphanSchool);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      expect(mockClassRepository.createClass).not.toHaveBeenCalled();
    });

    it('should re-throw an ApiError thrown by the repository unchanged', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(buildActiveSchool());
      const repoError = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockClassRepository.createClass.mockRejectedValue(repoError);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toBe(repoError);
    });

    it('should wrap unexpected DB errors as ApiError 500 with DATABASE_QUERY_FAILED', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(buildActiveSchool());
      mockClassRepository.createClass.mockRejectedValue(new Error('connection lost'));

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.create(superAdminContext, validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });
});
