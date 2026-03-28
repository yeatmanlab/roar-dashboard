import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../types/auth-context';
import type { ProgressStudentsQuery, ReportTaskMetadata, ProgressStudent } from '@roar-dashboard/api-contract';
import { ReportService } from '../services/report/report.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

const reportService = ReportService();

/**
 * Reports controller.
 *
 * Thin HTTP mapping layer for reporting endpoints.
 * Delegates all business logic to the report service.
 */
export const ReportsController = {
  /**
   * List paginated student progress for an administration.
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration to report on
   * @param query - Query parameters (scope, filters, pagination, sort)
   */
  listProgressStudents: async (authContext: AuthContext, administrationId: string, query: ProgressStudentsQuery) => {
    try {
      const result = await reportService.listProgressStudents(authContext, administrationId, query);

      // Map service types to contract types for the response.
      // Shapes are structurally identical — this is a type boundary, not a data transformation.
      const tasks: ReportTaskMetadata[] = result.tasks;
      const items: ProgressStudent[] = result.items;

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            tasks,
            items,
            pagination: {
              page: query.page,
              perPage: query.perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / query.perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
