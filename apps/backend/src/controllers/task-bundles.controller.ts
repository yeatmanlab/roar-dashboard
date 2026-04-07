import type {
  TaskBundleListItem,
  TaskBundleListQuery,
  TaskBundleVariantItem as ContractVariantItem,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import {
  TaskBundleService,
  type TaskBundleWithVariants,
  type TaskBundleVariantItem,
} from '../services/task-bundle/task-bundle.service';
import type { AuthContext } from '../types/auth-context';
import { toErrorResponse } from '../utils/to-error-response.util';

const taskBundleService = TaskBundleService();

/**
 * Maps a service task bundle variant item to the API contract shape.
 * Converts Date fields to ISO strings and spreads embed fields only when present.
 *
 * @param item - The service-layer variant item
 * @returns The API-formatted variant item
 */
function transformVariantItem(item: TaskBundleVariantItem): ContractVariantItem {
  return {
    taskVariantId: item.taskVariantId,
    taskSlug: item.taskSlug,
    taskName: item.taskName,
    taskVariantName: item.taskVariantName,
    sortOrder: item.sortOrder,
    // Embed fields — only spread when present so the key is absent (not undefined)
    // in the base response. This preserves the contract's .optional() semantics.
    ...(item.taskId !== undefined && { taskId: item.taskId }),
    ...(item.taskImage !== undefined && { taskImage: item.taskImage }),
    ...(item.description !== undefined && { description: item.description }),
    ...(item.status !== undefined && { status: item.status }),
    ...(item.createdAt !== undefined && { createdAt: item.createdAt.toISOString() }),
    ...(item.updatedAt !== undefined && { updatedAt: item.updatedAt?.toISOString() ?? null }),
    ...(item.parameters !== undefined && { parameters: item.parameters }),
  };
}

/**
 * Maps a service task bundle (with variants) to the API contract shape.
 * Converts Date fields to ISO strings.
 *
 * @param bundle - The service-layer task bundle with variants
 * @returns The API-formatted task bundle list item
 */
function transformTaskBundle(bundle: TaskBundleWithVariants): TaskBundleListItem {
  return {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    image: bundle.image,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt?.toISOString() ?? null,
    taskVariants: bundle.taskVariants.map(transformVariantItem),
  };
}

/**
 * Handles HTTP concerns for the /task-bundles endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization live in TaskBundleService.
 */
export const TaskBundlesController = {
  /**
   * List task bundles with their associated task variants.
   *
   * Delegates to TaskBundleService for authorization and business logic.
   * Requires super admin privileges.
   *
   * @param authContext - User's authentication context (requires super admin)
   * @param query - Query parameters for pagination, sort, search, embed, and filters
   * @returns Paginated list of task bundles with their variant lists
   */
  list: async (authContext: AuthContext, query: TaskBundleListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, search, embed, filter } = query;

      const result = await taskBundleService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(search !== undefined && { search }),
        embed,
        filters: filter,
      });

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map(transformTaskBundle),
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
