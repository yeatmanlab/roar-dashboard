import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { TaskBundleRepository } from '../../repositories/task-bundle.repository';
import {
  TaskBundleVariantRepository,
  type TaskBundleVariantWithTaskDetails,
} from '../../repositories/task-bundle-variant.repository';
import { TaskVariantParameterRepository } from '../../repositories/task-variant-parameter.repository';
import type { AuthContext } from '../../types/auth-context';
import type { ParsedFilter } from '../../types/filter';

/**
 * Sort field constants for the task bundle list.
 * Mirrors the contract's sort fields so the service layer has typed access
 * without depending on the contract module at runtime.
 */
export const TaskBundleSortField = {
  NAME: 'name',
  SLUG: 'slug',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/** Derived from TaskBundleSortField — kept local to avoid importing from the api-contract in service logic. */
export type TaskBundleSortFieldType = (typeof TaskBundleSortField)[keyof typeof TaskBundleSortField];

/** Sort order for listing task bundles */
type SortOrder = 'asc' | 'desc';

// The embed option value — defined locally to avoid importing from the api-contract in service logic
const EMBED_TASK_VARIANT_DETAILS = 'taskVariantDetails' as const;
type EmbedOption = typeof EMBED_TASK_VARIANT_DETAILS;

/**
 * Options for listing task bundles.
 */
export interface ListTaskBundlesOptions {
  page: number;
  perPage: number;
  sortBy: TaskBundleSortFieldType;
  sortOrder: SortOrder;
  search?: string;
  embed?: EmbedOption[];
  filters: ParsedFilter[];
}

/**
 * A task variant item within a bundle response.
 *
 * The base fields (taskVariantId, taskSlug, taskName, taskVariantName, sortOrder) are always present.
 * The embed fields are present only when embed=taskVariantDetails is requested.
 */
export interface TaskBundleVariantItem {
  // Always present
  taskVariantId: string;
  taskSlug: string;
  taskName: string;
  taskVariantName: string | null;
  sortOrder: number;
  // Present only when embed=taskVariantDetails
  taskId?: string;
  taskImage?: string | null;
  description?: string | null;
  status?: TaskBundleVariantWithTaskDetails['status'];
  createdAt?: Date;
  updatedAt?: Date | null;
  parameters?: { name: string; value: unknown }[];
}

/**
 * A task bundle with its associated variant list.
 */
export interface TaskBundleWithVariants {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  taskVariants: TaskBundleVariantItem[];
}

/**
 * Paginated result for the task bundle list.
 */
export interface ListTaskBundlesResult {
  items: TaskBundleWithVariants[];
  totalItems: number;
}

export function TaskBundleService({
  taskBundleRepository = new TaskBundleRepository(),
  taskBundleVariantRepository = new TaskBundleVariantRepository(),
  taskVariantParameterRepository = new TaskVariantParameterRepository(),
}: {
  taskBundleRepository?: TaskBundleRepository;
  taskBundleVariantRepository?: TaskBundleVariantRepository;
  taskVariantParameterRepository?: TaskVariantParameterRepository;
} = {}) {
  /**
   * List task bundles with their associated task variants.
   *
   * Authorization behavior:
   * - Super admin only — returns 403 for all other callers.
   *
   * Each bundle in the response always includes a summary variant list (taskVariantId,
   * taskSlug, taskName, taskVariantName, sortOrder, and full task variant metadata).
   *
   * When `embed` includes `'taskVariantDetails'`, each variant is additionally enriched
   * with its configuration parameters via a single bulk fetch (no N+1).
   *
   * Supports free-text search across bundle name/description, task slug, and variant name.
   * Supports structured filter expressions (e.g. taskBundle.slug:eq:some-slug).
   *
   * @param authContext - The caller's auth context
   * @param options - Pagination, sort, search, embed, and filter options
   * @returns Paginated list of task bundles with their variant lists
   * @throws {ApiError} FORBIDDEN if the caller is not a super admin
   * @throws {ApiError} DATABASE_QUERY_FAILED if any query fails unexpectedly
   */
  async function list(authContext: AuthContext, options: ListTaskBundlesOptions): Promise<ListTaskBundlesResult> {
    const { userId, isSuperAdmin } = authContext;

    // Super admin only — no DB call to protect, so auth check lives before try block
    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super admin attempted to list task bundles');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

    const { page, perPage, sortBy, sortOrder, search, embed = [], filters } = options;

    try {
      const bundleResult = await taskBundleRepository.listAll({
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(search !== undefined && { search }),
        filters,
      });

      if (bundleResult.totalItems === 0) {
        return { items: [], totalItems: 0 };
      }

      const bundleIds = bundleResult.items.map((b) => b.id);

      // Bulk-fetch all variants with task details for the returned bundles
      const allVariants = await taskBundleVariantRepository
        .getVariantsWithTaskDetailsByBundleIds(bundleIds)
        .catch((err) => {
          throw new ApiError('Failed to retrieve task bundle variants', {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            code: ApiErrorCode.DATABASE_QUERY_FAILED,
            context: { userId, bundleIds },
            cause: err,
          });
        });

      // Group variants by bundleId for O(1) attachment
      const variantsByBundleId = new Map<string, TaskBundleVariantWithTaskDetails[]>();
      for (const variant of allVariants) {
        const existing = variantsByBundleId.get(variant.taskBundleId);
        if (existing) {
          existing.push(variant);
        } else {
          variantsByBundleId.set(variant.taskBundleId, [variant]);
        }
      }

      if (!embed.includes(EMBED_TASK_VARIANT_DETAILS)) {
        const items: TaskBundleWithVariants[] = bundleResult.items.map((bundle) => ({
          ...bundle,
          taskVariants: (variantsByBundleId.get(bundle.id) ?? []).map((variant) => ({
            taskVariantId: variant.taskVariantId,
            taskSlug: variant.taskSlug,
            taskName: variant.taskName,
            taskVariantName: variant.taskVariantName,
            sortOrder: variant.sortOrder,
          })),
        }));
        return { items, totalItems: bundleResult.totalItems };
      }

      // embed=taskVariantDetails: bulk-fetch parameters for all variants in a single query
      const variantIds = allVariants.map((v) => v.taskVariantId);

      const allParameters = await taskVariantParameterRepository.getByTaskVariantIds(variantIds).catch((err) => {
        throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, variantIds },
          cause: err,
        });
      });

      // Group parameters by variantId for O(1) attachment
      const paramsByVariantId = new Map<string, { name: string; value: unknown }[]>();
      for (const param of allParameters) {
        const existing = paramsByVariantId.get(param.taskVariantId);
        if (existing) {
          existing.push({ name: param.name, value: param.value });
        } else {
          paramsByVariantId.set(param.taskVariantId, [{ name: param.name, value: param.value }]);
        }
      }

      const items: TaskBundleWithVariants[] = bundleResult.items.map((bundle) => ({
        ...bundle,
        taskVariants: (variantsByBundleId.get(bundle.id) ?? []).map((variant) => ({
          taskVariantId: variant.taskVariantId,
          taskSlug: variant.taskSlug,
          taskName: variant.taskName,
          taskVariantName: variant.taskVariantName,
          sortOrder: variant.sortOrder,
          taskId: variant.taskId,
          taskImage: variant.taskImage,
          description: variant.description,
          status: variant.status,
          createdAt: variant.createdAt,
          updatedAt: variant.updatedAt,
          parameters: paramsByVariantId.get(variant.taskVariantId) ?? [],
        })),
      }));

      return { items, totalItems: bundleResult.totalItems };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, page, perPage } }, 'Failed to list task bundles');

      throw new ApiError('Failed to retrieve task bundles', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return { list };
}
