import { StatusCodes } from 'http-status-codes';
import {
  AdministrationService,
  type AdministrationWithEmbeds,
} from '../services/administration/administration.service';
import type { AdministrationsListQuery, Administration as ApiAdministration } from '@roar-dashboard/api-contract';

const administrationService = AdministrationService();

/**
 * Auth context passed from middleware.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Transform a database administration to the API response format.
 */
function transformAdministration(admin: AdministrationWithEmbeds): ApiAdministration {
  const result: ApiAdministration = {
    id: admin.id,
    name: admin.name,
    publicName: admin.namePublic,
    dates: {
      start: admin.dateStart.toISOString(),
      end: admin.dateEnd.toISOString(),
      created: admin.createdAt.toISOString(),
    },
    isOrdered: admin.isOrdered,
  };

  // Include stats if embedded
  if (admin.stats) {
    result.stats = admin.stats;
  }

  // Include tasks if embedded
  if (admin.tasks) {
    result.tasks = admin.tasks;
  }

  return result;
}

/**
 * AdministrationsController
 *
 * Handles HTTP concerns for the /administrations endpoints.
 * Calls AdministrationService for business logic and formats responses.
 */
export const AdministrationsController = {
  /**
   * List administrations with pagination, sorting, and optional embeds.
   */
  list: async (authContext: AuthContext, query: AdministrationsListQuery) => {
    const { page, perPage, sortBy, sortOrder, embed } = query;

    const result = await administrationService.list(authContext, {
      page,
      perPage,
      sortBy,
      sortOrder,
      embed,
    });

    // Transform to API response format
    const items = result.items.map(transformAdministration);

    const totalPages = Math.ceil(result.totalItems / perPage);

    return {
      status: StatusCodes.OK as const,
      body: {
        data: {
          items,
          pagination: {
            page,
            perPage,
            totalItems: result.totalItems,
            totalPages,
          },
        },
      },
    };
  },
};
