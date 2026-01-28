import { initContract } from '@ts-rest/core';
import { AdministrationsListQuerySchema, AdministrationsListResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /administrations endpoints.
 * Provides access to administrations the authenticated user can view.
 */
export const AdministrationsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: AdministrationsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationsListResponseSchema),
        401: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List administrations',
      description:
        'Returns a paginated list of administrations the authenticated user has access to. ' +
        'Use ?status=active|past|upcoming to filter by date status. ' +
        'Use ?embed=stats to include assignment stats. Use ?embed=tasks to include task variants.',
    },
  },
  { pathPrefix: '/administrations' },
);
