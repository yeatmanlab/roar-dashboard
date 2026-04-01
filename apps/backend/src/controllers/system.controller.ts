import { StatusCodes } from 'http-status-codes';
import type { SyncFgaQuery } from '@roar-dashboard/api-contract';
import { SystemService } from '../services/system/system.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import { logger } from '../logger';
import type { AuthContext } from '../types/auth-context';

const systemService = SystemService();

/**
 * System controller — handles super-admin-only system operations.
 *
 * Thin HTTP mapping layer. Authorization is enforced in the service layer.
 */
export const SystemController = {
  /**
   * Sync FGA tuples from existing Postgres junction table data.
   *
   * - Dry-run (`?dryRun=true`): synchronous, returns 200 with tuple counts
   * - Real run (`?dryRun=false`): returns 202 immediately, runs sync in the background
   *
   * @param authContext - The authenticated user's context
   * @param query - Query parameters including dryRun flag
   * @returns Sync result (200) or accepted acknowledgement (202)
   */
  syncFga: async (authContext: AuthContext, query: SyncFgaQuery) => {
    // Dry-run: synchronous, return counts
    if (query.dryRun) {
      try {
        const result = await systemService.authorization.syncFgaStore(authContext, { dryRun: true });
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
    }

    // Real run: fire-and-forget, return 202
    systemService.authorization.syncFgaStore(authContext, { dryRun: false }).catch((error) => {
      logger.error({ err: error, context: { userId: authContext.userId } }, 'FGA sync failed (async)');
    });

    return {
      status: StatusCodes.ACCEPTED as const,
      body: { data: { message: 'FGA sync started. Check server logs for progress.' } },
    };
  },
};
