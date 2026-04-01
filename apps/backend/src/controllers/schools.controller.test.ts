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

import { SchoolService, type ISchoolService } from '../services/school/school.service';

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
    } as ISchoolService);
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
        sortBy: 'name',
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
    it('should return a single school with 200 status', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, mockSchool.id);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      const data = (result.body as { data: unknown }).data as Record<string, unknown>;
      expect(data.id).toBe(mockSchool.id);
      expect(data.name).toBe(mockSchool.name);
      expect(data.orgType).toBe('school');
    });

    it('should handle ApiError with 404 Not Found', async () => {
      const error = new ApiError('School not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockGetById.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'non-existent-id');

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      const error = new ApiError('Access denied', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockGetById.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'unauthorized-school-id');

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetById.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, 'some-school-id');

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockGetById.mockRejectedValue(error);

      const { SchoolsController: Controller } = await import('./schools.controller');

      await expect(Controller.getById(mockAuthContext, 'some-school-id')).rejects.toThrow('Unexpected error');
    });

    it('should transform school with location data', async () => {
      const mockSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        locationAddressLine1: '123 Main St',
        locationCity: 'Springfield',
        locationStateProvince: 'IL',
        locationPostalCode: '62701',
        locationCountry: 'US',
        locationLatLong: { x: -89.6501, y: 39.7817 },
      });
      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, mockSchool.id);

      const data = expectOkResponse(result);
      expect(data).toHaveProperty('location');
      expect(data.location).toMatchObject({
        addressLine1: '123 Main St',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62701',
        country: 'US',
      });
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
      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, mockSchool.id);

      const data = expectOkResponse(result);
      expect(data).not.toHaveProperty('location');
    });

    it('should omit identifiers when all identifier fields are null', async () => {
      const mockSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        mdrNumber: null,
        ncesId: null,
        stateId: null,
        schoolNumber: null,
      });
      mockGetById.mockResolvedValue(mockSchool);

      const { SchoolsController: Controller } = await import('./schools.controller');

      const result = await Controller.getById(mockAuthContext, mockSchool.id);

      const data = expectOkResponse(result);
      expect(data).not.toHaveProperty('identifiers');
    });
  });
});
