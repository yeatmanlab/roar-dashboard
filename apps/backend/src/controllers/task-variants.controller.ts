import type {
  TaskVariantsListQuery,
  TaskVariantListItem as ContractTaskVariantListItem,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { TaskVariantService, type TaskVariantListItem } from '../services/task-variant/task-variant.service';
import type { AuthContext } from '../types/auth-context';
import { toErrorResponse } from '../utils/to-error-response.util';

const taskVariantService = TaskVariantService();

/**
 * Maps a service task variant list item to the API contract shape.
 * Converts Date fields to ISO strings.
 *
 * @param item - The service-layer task variant list item
 * @returns The API-formatted task variant list item
 */
function transformTaskVariantListItem(item: TaskVariantListItem): ContractTaskVariantListItem {
  return {
    id: item.id,
    taskId: item.taskId,
    name: item.name,
    description: item.description,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt?.toISOString() ?? null,
    taskName: item.taskName,
    taskSlug: item.taskSlug,
    taskImage: item.taskImage,
    ...(item.parameters !== undefined && { parameters: item.parameters }),
  };
}

/**
 * Handles HTTP concerns for the /task-variants endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization live in TaskVariantService.
 */
export const TaskVariantsController = {
  /**
   * List all published task variants across all tasks.
   *
   * Delegates to TaskVariantService for authorization and business logic.
   * Requires super admin privileges.
   *
   * @param authContext - User's authentication context (requires super admin)
   * @param query - Query parameters for pagination, sort, search, embed, and filters
   * @returns Paginated list of published task variants with optional embedded parameters
   */
  list: async (authContext: AuthContext, query: TaskVariantsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, search, embed, filter } = query;

      const result = await taskVariantService.listAllPublished(authContext, {
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
            items: result.items.map(transformTaskVariantListItem),
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
