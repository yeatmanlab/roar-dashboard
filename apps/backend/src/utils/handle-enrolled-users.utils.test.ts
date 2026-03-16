import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  getEnrolledUsersFilterConditions,
  handleSubResourceError,
  handleSubResourceResponse,
  ENROLLED_USERS_SORT_COLUMNS,
  type EnrolledUserEntity,
  type ListEnrolledUsersOptions,
} from './handle-enrolled-users';
import { users } from '../db/schema';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { UserRole } from '../enums/user-role.enum';
import { ApiError } from '../errors/api-error';
import { UserFactory } from '../test-support/factories/user.factory';

describe('handle-enrolled-users', () => {
  describe('ENROLLED_USERS_SORT_COLUMNS', () => {
    it('maps nameLast to users.nameLast column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.nameLast).toBe(users.nameLast);
    });

    it('maps username to users.username column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.username).toBe(users.username);
    });

    it('maps grade to users.grade column', () => {
      expect(ENROLLED_USERS_SORT_COLUMNS.grade).toBe(users.grade);
    });
  });

  describe('getEnrolledUsersFilterConditions', () => {
    it('returns empty array when no filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10 };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toEqual([]);
    });

    it('returns grade condition when grade filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'] };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(1);
    });

    it('returns role condition when role filter provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(1);
    });

    it('returns both conditions when grade and role filters provided', () => {
      const options: ListEnrolledUsersOptions = { page: 1, perPage: 10, grade: ['5'], role: UserRole.STUDENT };
      const conditions = getEnrolledUsersFilterConditions(options);
      expect(conditions).toHaveLength(2);
    });
  });

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

  describe('handleSubResourceResponse', () => {
    const createMockEnrolledUser = (overrides: Partial<EnrolledUserEntity> = {}): EnrolledUserEntity => ({
      ...UserFactory.build(),
      role: UserRole.STUDENT,
      enrollmentStart: new Date('2024-01-01T00:00:00Z'),
      ...overrides,
    });

    it('returns OK status with paginated response', () => {
      const mockUsers = [createMockEnrolledUser()];
      const result = handleSubResourceResponse({ items: mockUsers, totalItems: 1 }, 1, 10);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.pagination).toEqual({
        page: 1,
        perPage: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('converts enrollmentStart Date to ISO string', () => {
      const mockUsers = [createMockEnrolledUser({ enrollmentStart: new Date('2024-06-15T10:30:00Z') })];
      const result = handleSubResourceResponse({ items: mockUsers, totalItems: 1 }, 1, 10);

      expect(result.body.data.items[0]!.enrollmentStart).toBe('2024-06-15T10:30:00.000Z');
    });

    it('includes role in response', () => {
      const mockUsers = [createMockEnrolledUser({ role: UserRole.TEACHER })];
      const result = handleSubResourceResponse({ items: mockUsers, totalItems: 1 }, 1, 10);

      expect(result.body.data.items[0]!.role).toBe(UserRole.TEACHER);
    });

    it('calculates totalPages correctly', () => {
      const mockUsers = [createMockEnrolledUser()];

      // 25 items, 10 per page = 3 pages
      const result = handleSubResourceResponse({ items: mockUsers, totalItems: 25 }, 1, 10);
      expect(result.body.data.pagination.totalPages).toBe(3);

      // 30 items, 10 per page = 3 pages
      const result2 = handleSubResourceResponse({ items: mockUsers, totalItems: 30 }, 1, 10);
      expect(result2.body.data.pagination.totalPages).toBe(3);

      // 31 items, 10 per page = 4 pages
      const result3 = handleSubResourceResponse({ items: mockUsers, totalItems: 31 }, 1, 10);
      expect(result3.body.data.pagination.totalPages).toBe(4);
    });

    it('handles empty results', () => {
      const result = handleSubResourceResponse({ items: [], totalItems: 0 }, 1, 10);

      expect(result.body.data.items).toEqual([]);
      expect(result.body.data.pagination.totalItems).toBe(0);
      expect(result.body.data.pagination.totalPages).toBe(0);
    });

    it('maps all user fields correctly', () => {
      const mockUser = createMockEnrolledUser({
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
        role: UserRole.STUDENT,
        enrollmentStart: new Date('2024-01-15T00:00:00Z'),
      });

      const result = handleSubResourceResponse({ items: [mockUser], totalItems: 1 }, 1, 10);
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
      expect(item.role).toBe(UserRole.STUDENT);
      expect(item.enrollmentStart).toBe('2024-01-15T00:00:00.000Z');
    });

    it('omits sensitive and internal fields from response', () => {
      const mockUser = createMockEnrolledUser({
        id: 'test-id',
        role: UserRole.STUDENT,
      });

      const result = handleSubResourceResponse({ items: [mockUser], totalItems: 1 }, 1, 10);
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
  });
});
