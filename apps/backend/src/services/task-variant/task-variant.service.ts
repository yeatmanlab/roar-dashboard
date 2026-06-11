import { SortOrder } from '@roar-platform/api-contract';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import {
  TaskVariantRepository,
  type ListAllPublishedOptions,
  type TaskVariantWithTaskDetails,
} from '../../repositories/task-variant.repository';
import { UserRepository } from '../../repositories/user.repository';
import { verifyPlatformAdminAccess } from '../authorization/verify-platform-admin-access';
import type { AuthContext } from '../../types/auth-context';
import type { ParsedFilter } from '../../types/filter';

/**
 * Allowed sort fields for the published task variant list.
 * Mirrors the contract's sort fields but is defined independently so the
 * service can add internal-only sort fields without changing the contract.
 */
export const TaskVariantSortField = {
  VARIANT_NAME: 'variant.name',
  VARIANT_CREATED_AT: 'variant.createdAt',
  VARIANT_UPDATED_AT: 'variant.updatedAt',
  TASK_NAME: 'task.name',
  TASK_SLUG: 'task.slug',
} as const;

export type TaskVariantSortFieldType = (typeof TaskVariantSortField)[keyof typeof TaskVariantSortField];

/**
 * Allowed embed options for the published task variant list.
 */
const EMBED_PARAMETERS = 'parameters' as const;
type EmbedOption = typeof EMBED_PARAMETERS;

/**
 * Options for listing all published task variants across all tasks.
 */
export interface ListTaskVariantsOptions {
  page: number;
  perPage: number;
  sortBy: TaskVariantSortFieldType;
  sortOrder: SortOrder;
  search?: string;
  embed?: EmbedOption[];
  filters: ParsedFilter[];
}

/**
 * A published task variant with optional embedded parameters.
 */
export interface TaskVariantListItem extends TaskVariantWithTaskDetails {
  parameters?: { name: string; value: unknown }[];
}

/**
 * Paginated result of the published task variant list.
 */
export interface ListTaskVariantsResult {
  items: TaskVariantListItem[];
  totalItems: number;
}

export function TaskVariantService({
  taskVariantRepository = new TaskVariantRepository(),
  taskVariantParameterRepository = new TaskVariantParameterRepository(),
  userRepository = new UserRepository(),
}: {
  taskVariantRepository?: TaskVariantRepository;
  taskVariantParameterRepository?: TaskVariantParameterRepository;
  userRepository?: UserRepository;
} = {}) {
  /**
   * List all published task variants across all tasks.
   *
   * Authorization behavior:
   * - Super admin: full access (bypasses the role lookup)
   * - Platform administrator (active `platform_admin` org/group membership): full access
   * - All other callers: 403 Forbidden
   *
   * Supports free-text search across variant name, variant description, task name,
   * task slug, and task description. Supports structured filter expressions for
   * task.id and task.slug. Supports sorting by variant and task fields.
   *
   * When `embed` includes `'parameters'`, each variant is enriched with its
   * configuration parameters via a single bulk fetch (no N+1).
   *
   * @param authContext - The caller's auth context
   * @param options - Pagination, sort, search, embed, and filter options
   * @returns Paginated list of published task variants with optional embedded parameters
   * @throws {ApiError} FORBIDDEN if the caller is neither a super admin nor a platform administrator
   * @throws {ApiError} DATABASE_QUERY_FAILED if the query fails unexpectedly
   */
  async function listAllPublished(
    authContext: AuthContext,
    options: ListTaskVariantsOptions,
  ): Promise<ListTaskVariantsResult> {
    const { userId } = authContext;

    const { page, perPage, sortBy, sortOrder, search, embed = [], filters } = options;

    const repoOptions: ListAllPublishedOptions = {
      page,
      perPage,
      sortBy,
      sortOrder,
      ...(search !== undefined && { search }),
      filters,
    };

    try {
      // Authorization: super admin or active platform administrator. Lives inside the
      // try block because the platform admin check performs a role lookup in the DB.
      await verifyPlatformAdminAccess(authContext, userRepository, 'task-variants.list');

      const result = await taskVariantRepository.listAllPublished(repoOptions);

      if (result.totalItems === 0) {
        return { items: [], totalItems: 0 };
      }

      if (!embed.includes(EMBED_PARAMETERS)) {
        return { items: result.items, totalItems: result.totalItems };
      }

      // Bulk-fetch parameters for all returned variants in a single query
      const variantIds = result.items.map((v) => v.id);

      const allParameters = await taskVariantParameterRepository.getByTaskVariantIds(variantIds).catch((err) => {
        throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, variantIds },
          cause: err,
        });
      });

      // Group parameters by variant ID for O(1) lookup during attachment
      const paramsByVariantId = new Map<string, { name: string; value: unknown }[]>();
      for (const param of allParameters) {
        const existing = paramsByVariantId.get(param.taskVariantId);
        if (existing) {
          existing.push({ name: param.name, value: param.value });
        } else {
          paramsByVariantId.set(param.taskVariantId, [{ name: param.name, value: param.value }]);
        }
      }

      const items: TaskVariantListItem[] = result.items.map((variant) => ({
        ...variant,
        parameters: paramsByVariantId.get(variant.id) ?? [],
      }));

      return { items, totalItems: result.totalItems };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, page, perPage } }, 'Failed to list all published task variants');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return { listAllPublished };
}
