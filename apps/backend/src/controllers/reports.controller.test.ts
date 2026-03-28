import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { ProgressStudentsQuery, ReportTaskMetadata, ProgressStudent } from '@roar-dashboard/api-contract';

vi.mock('../services/report/report.service', () => ({
  ReportService: vi.fn(),
}));

import { ReportService } from '../services/report/report.service';

function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

describe('ReportsController', () => {
  const mockListProgressStudents = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const testAdminId = 'admin-uuid-1';

  const testQuery: ProgressStudentsQuery = {
    scopeType: 'district',
    scopeId: 'district-uuid-1',
    page: 1,
    perPage: 25,
    sortBy: 'user.lastName',
    sortOrder: 'asc',
    filter: [],
  };

  const testTasks: ReportTaskMetadata[] = [
    { taskId: 'task-1', taskSlug: 'swr', taskName: 'ROAR - Word', orderIndex: 0 },
  ];

  const testItems: ProgressStudent[] = [
    {
      user: {
        userId: 'student-1',
        assessmentPid: 'pid-student-1',
        username: 'jdoe',
        email: 'jdoe@school.edu',
        firstName: 'Jane',
        lastName: 'Doe',
        grade: '3',
        schoolName: 'Lincoln Elementary',
      },
      progress: {
        'task-1': { status: 'completed', startedAt: null, completedAt: '2025-09-15T10:00:00.000Z' },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportService).mockReturnValue({
      listProgressStudents: mockListProgressStudents,
    });
  });

  describe('listProgressStudents', () => {
    it('returns 200 with tasks, items, and pagination', async () => {
      mockListProgressStudents.mockResolvedValue({
        tasks: testTasks,
        items: testItems,
        totalItems: 1,
      });

      const { ReportsController } = await import('./reports.controller');
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      const data = expectOkResponse(result);
      expect(data.tasks).toEqual(testTasks);
      expect(data.items).toEqual(testItems);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('calculates totalPages correctly', async () => {
      mockListProgressStudents.mockResolvedValue({
        tasks: testTasks,
        items: testItems,
        totalItems: 51,
      });

      const { ReportsController } = await import('./reports.controller');
      const query = { ...testQuery, perPage: 25 };
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, query);

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(3); // ceil(51/25) = 3
    });

    it('returns totalPages 0 for empty results', async () => {
      mockListProgressStudents.mockResolvedValue({
        tasks: testTasks,
        items: [],
        totalItems: 0,
      });

      const { ReportsController } = await import('./reports.controller');
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('maps ApiError to typed error response for 404', async () => {
      mockListProgressStudents.mockRejectedValue(
        new ApiError('Not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { ReportsController } = await import('./reports.controller');
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('maps ApiError to typed error response for 403', async () => {
      mockListProgressStudents.mockRejectedValue(
        new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { ReportsController } = await import('./reports.controller');
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('maps ApiError to typed error response for 400', async () => {
      mockListProgressStudents.mockRejectedValue(
        new ApiError('Bad request', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { ReportsController } = await import('./reports.controller');
      const result = await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('re-throws non-ApiError errors', async () => {
      mockListProgressStudents.mockRejectedValue(new Error('unexpected'));

      const { ReportsController } = await import('./reports.controller');

      await expect(ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery)).rejects.toThrow(
        'unexpected',
      );
    });

    it('passes authContext, administrationId, and query to service', async () => {
      mockListProgressStudents.mockResolvedValue({ tasks: [], items: [], totalItems: 0 });

      const { ReportsController } = await import('./reports.controller');
      await ReportsController.listProgressStudents(mockAuthContext, testAdminId, testQuery);

      expect(mockListProgressStudents).toHaveBeenCalledWith(mockAuthContext, testAdminId, testQuery);
    });
  });
});
