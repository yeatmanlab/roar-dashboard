import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { OrgType } from '../enums/org-type.enum';

// Mock the SchoolService module
vi.mock('../services/school/school.service', () => ({
  SchoolService: vi.fn(),
}));

import { SchoolService } from '../services/school/school.service';

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

/**
 * Type-safe assertion helper for error responses.
 */
function expectErrorResponse(
  result: { status: number; body: { data: unknown } | { error: unknown } },
  expectedStatus: number,
) {
  expect(result.status).toBe(expectedStatus);
  expect(result.body).toHaveProperty('error');
  return (result.body as { error: unknown }).error;
}

describe('SchoolsController', () => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(SchoolService).mockReturnValue({
      list: mockList,
      getById: mockGetById,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  describe('list', () => {
    it('should return paginated schools with 200 status', async () => {
      const mockSchools = [
        OrgFactory.build({ orgType: OrgType.SCHOOL }),
        OrgFactory.build({ orgType: OrgType.SCHOOL }),
      ];
      mockList.mockResolvedValue({
        items: mockSchools,
        totalItems: 2,
      });

      // Re-import to pick up the mock
      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform school fields to API response format', async () => {
      const mockSchool = OrgFactory.build({
        id: 'school-uuid-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-uuid-456',
        locationAddressLine1: '456 School St',
        locationCity: 'Springfield',
        locationStateProvince: 'IL',
        locationPostalCode: '62701',
        locationCountry: 'USA',
        createdAt: new Date('2023-06-15T10:30:00Z'),
        updatedAt: new Date('2023-06-16T11:00:00Z'),
        isRosteringRootOrg: false,
      });
      mockList.mockResolvedValue({
        items: [mockSchool],
        totalItems: 1,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      const school = data.items[0];

      expect(school).toMatchObject({
        id: 'school-uuid-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-uuid-456',
        location: {
          addressLine1: '456 School St',
          city: 'Springfield',
          stateProvince: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
        isRosteringRootOrg: false,
      });
    });

    it('should include counts when embed=counts is requested', async () => {
      const mockSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
      });
      const mockSchoolWithCounts = {
        ...mockSchool,
        counts: {
          users: 50,
          classes: 10,
        },
      };

      mockList.mockResolvedValue({
        items: [mockSchoolWithCounts],
        totalItems: 1,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: ['counts'],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]!.counts).toEqual({
        users: 50,
        classes: 10,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const mockSchools = OrgFactory.buildList(3, { orgType: OrgType.SCHOOL });
      mockList.mockResolvedValue({
        items: mockSchools,
        totalItems: 53,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 2,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(3); // ceil(53 / 25) = 3
    });

    it('should pass includeEnded parameter to service', async () => {
      mockList.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        includeEnded: true,
        embed: [],
      });

      expect(mockList).toHaveBeenCalledWith(
        mockAuthContext,
        expect.objectContaining({
          includeEnded: true,
        }),
      );
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      const error = new ApiError('Access denied', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockList.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockList.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockList.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      await expect(
        Controller.list(mockAuthContext, {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
          embed: [],
        }),
      ).rejects.toThrow('Unexpected error');
    });

    it('should omit location when all location fields are null', async () => {
      const mockSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        locationAddressLine1: null,
        locationAddressLine2: null,
        locationCity: null,
        locationStateProvince: null,
        locationPostalCode: null,
        locationCountry: null,
        locationLatLong: null,
      });
      mockList.mockResolvedValue({
        items: [mockSchool],
        totalItems: 1,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('location');
    });

    it('should omit identifiers when all identifier fields are null', async () => {
      const mockSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        mdrNumber: null,
        ncesId: null,
        stateId: null,
        schoolNumber: null,
      });
      mockList.mockResolvedValue({
        items: [mockSchool],
        totalItems: 1,
      });

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('identifiers');
    });
  });

  describe('getById', () => {
    it('should return a school with 200 status', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-456',
        isRosteringRootOrg: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data).toMatchObject({
        id: 'school-123',
        name: 'Test School',
        abbreviation: 'TS',
        parentOrgId: 'district-456',
      });
      expect(mockGetById).toHaveBeenCalledWith(mockAuthContext, 'school-123');
    });

    it('should transform school with location data', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-456',
        isRosteringRootOrg: false,
        locationAddressLine1: '123 Main St',
        locationCity: 'Test City',
        locationStateProvince: 'CA',
        locationPostalCode: '12345',
        locationCountry: 'USA',
        locationLatLong: { x: -122.4194, y: 37.7749 },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.location).toMatchObject({
        addressLine1: '123 Main St',
        city: 'Test City',
        stateProvince: 'CA',
        postalCode: '12345',
        country: 'USA',
        coordinates: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
      });
    });

    it('should transform school with identifiers', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-456',
        isRosteringRootOrg: false,
        mdrNumber: 'MDR123',
        ncesId: 'NCES456',
        stateId: 'STATE789',
        schoolNumber: 'SCH001',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.identifiers).toMatchObject({
        mdrNumber: 'MDR123',
        ncesId: 'NCES456',
        stateId: 'STATE789',
        schoolNumber: 'SCH001',
      });
    });

    it('should handle rosteringEnded timestamp', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Ended School',
        abbreviation: 'ES',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-456',
        isRosteringRootOrg: false,
        rosteringEnded: new Date('2023-12-31'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.rosteringEnded).toBe('2023-12-31T00:00:00.000Z');
    });

    it('should handle ApiError with 404 Not Found', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('School not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-999');

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('Access denied', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('Database error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockGetById.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      await expect(Controller.getById(mockAuthContext, 'school-123')).rejects.toThrow('Unexpected error');
    });

    it('should include parentOrgId in response', async () => {
      const mockSchool = {
        id: 'school-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-456',
        isRosteringRootOrg: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'school-123');

      expect(result.status).toBe(StatusCodes.OK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.parentOrgId).toBe('district-456');
    });
  });
});
