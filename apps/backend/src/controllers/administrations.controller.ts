import { StatusCodes } from 'http-status-codes';
import { AdministrationService } from '../services/administration/administration.service';
import type { AdministrationsListQuery } from '@roar-dashboard/api-contract';

const administrationService = AdministrationService();

/**
 * AdministrationsController
 *
 * Handles HTTP concerns for the /administrations endpoints.
 * Calls AdministrationService for business logic and formats responses.
 */
export const AdministrationsController = {
  /**
   * List administrations with pagination, search, and sorting.
   */
  list: async (query: AdministrationsListQuery) => {
    const { page, perPage, search, sortBy, sortOrder } = query;

    const result = await administrationService.list({
      page,
      perPage,
      search,
      sortBy,
      sortOrder,
    });

    // Transform to API response format
    const items = result.items.map((admin) => ({
      id: admin.id,
      name: admin.nameInternal,
      publicName: admin.namePublic,
      dates: {
        start: admin.dateStart.toISOString(),
        end: admin.dateEnd.toISOString(),
        created: admin.createdAt.toISOString(),
      },
      isOrdered: admin.isOrdered,
    }));

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
