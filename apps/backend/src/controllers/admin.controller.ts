import { StatusCodes } from 'http-status-codes';
import type { BackfillFgaQuery } from '@roar-dashboard/api-contract';
import { FgaBackfillService } from '../services/authorization/fga-backfill.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';

const backfillService = FgaBackfillService();

/**
 * Admin controller — handles super-admin-only operations.
 *
 * Thin HTTP mapping layer. Authorization is enforced in the service layer.
 */
export const AdminController = {
  /**
   * Backfill FGA tuples from existing Postgres junction table data.
   *
   * @param authContext - The authenticated user's context
   * @param query - Query parameters including dryRun flag
   * @returns Backfill result with per-category tuple counts
   */
  backfillFga: async (authContext: AuthContext, query: BackfillFgaQuery) => {
    try {
      const result = await backfillService.backfill(authContext, { dryRun: query.dryRun });
      return {
        status: StatusCodes.OK as const,
        body: { data: result },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },
};
