import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { handleSubResourceError, handleUserSubResourceResponse } from './enrolled-users.transform';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { UserRole } from '../../enums/user-role.enum';
import { UserFamilyRole } from '../../enums/user-family-role.enum';
import { ApiError } from '../../errors/api-error';
import { EnrolledUserFactory, EnrolledFamilyUserFactory } from '../../test-support/factories/user.factory';

describe('handle-enrolled-users', () => {
  describe('handleSubResourceError', () => {
    it('returns error response for ApiError with NOT_FOUND status', () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      const result = handleSubResourceError(error);

      expect(result).toHaveProperty('status', StatusCodes.NOT_FOUND);
      expect(result).toHaveProperty('body');
    });

    it('returns error response for ApiError with FORBIDDEN status', () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      const result = handleSubResourceError(error);

      expect(result).toHaveProperty('status', StatusCodes.FORBIDDEN);
      expect(result).toHaveProperty('body');
    });

    it('throws non-ApiError errors', () => {
      const error = new Error('Generic error');

      expect(() => handleSubResourceError(error)).toThrow('Generic error');
    });
  });

  describe('handleUserSubResourceResponse', () => {
    it('returns OK status with paginated response', () => {
      const mockUsers = [EnrolledUserFactory.build()];
      const result = handleUserSubResourceResponse({ items: mockUsers, totalItems: 1 }, 1, 10);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.pagination).toEqual({
        page: 1,
        perPage: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('includes role in response', () => {
      const mockUsers = [EnrolledUserFactory.build({ roles: [UserRole.TEACHER] })];
      const result = handleUserSubResourceResponse({ items: mockUsers, totalItems: 1 }, 1, 10);

      expect(result.body.data.items[0]!.roles).toEqual([UserRole.TEACHER]);
    });

    it('calculates totalPages correctly', () => {
      const mockUsers = [EnrolledUserFactory.build()];

      // 25 items, 10 per page = 3 pages
      const result = handleUserSubResourceResponse({ items: mockUsers, totalItems: 25 }, 1, 10);
      expect(result.body.data.pagination.totalPages).toBe(3);

      // 30 items, 10 per page = 3 pages
      const result2 = handleUserSubResourceResponse({ items: mockUsers, totalItems: 30 }, 1, 10);
      expect(result2.body.data.pagination.totalPages).toBe(3);

      // 31 items, 10 per page = 4 pages
      const result3 = handleUserSubResourceResponse({ items: mockUsers, totalItems: 31 }, 1, 10);
      expect(result3.body.data.pagination.totalPages).toBe(4);
    });

    it('handles empty results', () => {
      const result = handleUserSubResourceResponse({ items: [], totalItems: 0 }, 1, 10);

      expect(result.body.data.items).toEqual([]);
      expect(result.body.data.pagination.totalItems).toBe(0);
      expect(result.body.data.pagination.totalPages).toBe(0);
    });

    it('maps all user fields correctly', () => {
      const mockUser = EnrolledUserFactory.build({
        id: 'test-id',
        assessmentPid: 'test-pid',
        nameFirst: 'Jane',
        nameLast: 'Smith',
        username: 'janesmith',
        email: 'jane@example.com',
        gender: 'female',
        grade: '8',
        dob: '2008-05-15',
        studentId: 'stu-456',
        sisId: 'sis-456',
        stateId: 'state-456',
        localId: 'local-456',
        roles: [UserRole.STUDENT],
      });

      const result = handleUserSubResourceResponse({ items: [mockUser], totalItems: 1 }, 1, 10);
      const item = result.body.data.items[0]!;

      expect(item.id).toBe('test-id');
      expect(item.assessmentPid).toBe('test-pid');
      expect(item.nameFirst).toBe('Jane');
      expect(item.nameLast).toBe('Smith');
      expect(item.username).toBe('janesmith');
      expect(item.email).toBe('jane@example.com');
      expect(item.gender).toBe('female');
      expect(item.grade).toBe('8');
      expect(item.dob).toBe('2008-05-15');
      expect(item.studentId).toBe('stu-456');
      expect(item.sisId).toBe('sis-456');
      expect(item.stateId).toBe('state-456');
      expect(item.localId).toBe('local-456');
      expect(item.roles).toEqual([UserRole.STUDENT]);
    });

    it('omits sensitive and internal fields from response', () => {
      const mockUser = EnrolledUserFactory.build();

      const result = handleUserSubResourceResponse({ items: [mockUser], totalItems: 1 }, 1, 10);
      const item = result.body.data.items[0]!;

      // Ensure sensitive/internal fields are not exposed
      expect(item).not.toHaveProperty('authProvider');
      expect(item).not.toHaveProperty('authId');
      expect(item).not.toHaveProperty('nameMiddle');
      expect(item).not.toHaveProperty('userType');
      expect(item).not.toHaveProperty('schoolLevel');
      expect(item).not.toHaveProperty('statusEll');
      expect(item).not.toHaveProperty('statusFrl');
      expect(item).not.toHaveProperty('statusIep');
      expect(item).not.toHaveProperty('race');
      expect(item).not.toHaveProperty('hispanicEthnicity');
      expect(item).not.toHaveProperty('homeLanguage');
      expect(item).not.toHaveProperty('isSuperAdmin');
      expect(item).not.toHaveProperty('createdAt');
      expect(item).not.toHaveProperty('updatedAt');
    });

    it('handles EnrolledFamilyUserEntity with child role', () => {
      const mockFamilyUser = EnrolledFamilyUserFactory.build({ roles: [UserFamilyRole.CHILD] });
      const result = handleUserSubResourceResponse({ items: [mockFamilyUser], totalItems: 1 }, 1, 10);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.items[0]!.roles).toEqual([UserFamilyRole.CHILD]);
    });

    it('handles EnrolledFamilyUserEntity with parent role', () => {
      const mockFamilyUser = EnrolledFamilyUserFactory.build({ roles: [UserFamilyRole.PARENT] });
      const result = handleUserSubResourceResponse({ items: [mockFamilyUser], totalItems: 1 }, 1, 10);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.items[0]!.roles).toEqual([UserFamilyRole.PARENT]);
    });

    it('handles EnrolledFamilyUserEntity with multiple family roles', () => {
      const mockFamilyUser = EnrolledFamilyUserFactory.build({ roles: [UserFamilyRole.PARENT, UserFamilyRole.CHILD] });
      const result = handleUserSubResourceResponse({ items: [mockFamilyUser], totalItems: 1 }, 1, 10);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items[0]!.roles).toEqual([UserFamilyRole.PARENT, UserFamilyRole.CHILD]);
    });

    it('correctly discriminates between EnrolledUserEntity and EnrolledFamilyUserEntity', () => {
      const orgUser = EnrolledUserFactory.build({ roles: [UserRole.STUDENT] });
      const familyUser = EnrolledFamilyUserFactory.build({ roles: [UserFamilyRole.CHILD] });

      const result = handleUserSubResourceResponse({ items: [orgUser, familyUser], totalItems: 2 }, 1, 10);

      expect(result.body.data.items).toHaveLength(2);
      expect(result.body.data.items[0]!.roles).toEqual([UserRole.STUDENT]);
      expect(result.body.data.items[1]!.roles).toEqual([UserFamilyRole.CHILD]);
    });

    it('maps all family user fields correctly', () => {
      const mockFamilyUser = EnrolledFamilyUserFactory.build({
        id: 'family-user-id',
        assessmentPid: 'family-pid',
        nameFirst: 'John',
        nameLast: 'Doe',
        username: 'johndoe',
        email: 'john@example.com',
        gender: 'male',
        grade: '3',
        dob: '2015-03-20',
        studentId: 'fam-stu-123',
        sisId: 'fam-sis-123',
        stateId: 'fam-state-123',
        localId: 'fam-local-123',
        roles: [UserFamilyRole.CHILD],
      });

      const result = handleUserSubResourceResponse({ items: [mockFamilyUser], totalItems: 1 }, 1, 10);
      const item = result.body.data.items[0]!;

      expect(item.id).toBe('family-user-id');
      expect(item.assessmentPid).toBe('family-pid');
      expect(item.nameFirst).toBe('John');
      expect(item.nameLast).toBe('Doe');
      expect(item.username).toBe('johndoe');
      expect(item.email).toBe('john@example.com');
      expect(item.gender).toBe('male');
      expect(item.grade).toBe('3');
      expect(item.dob).toBe('2015-03-20');
      expect(item.studentId).toBe('fam-stu-123');
      expect(item.sisId).toBe('fam-sis-123');
      expect(item.stateId).toBe('fam-state-123');
      expect(item.localId).toBe('fam-local-123');
      expect(item.roles).toEqual([UserFamilyRole.CHILD]);
    });
  });
});
