import { initContract } from '@ts-rest/core';
import { DistrictsListQuerySchema, DistrictsListResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /districts endpoints.
 * Provides access to districts the authenticated user can view.
 */
export const DistrictsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: DistrictsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(DistrictsListResponseSchema),
        401: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List districts',
      description:
        'Returns a paginated list of districts the authenticated user has access to. ' +
        'Super admins can access all districts. Regular users only see districts they belong to. ' +
        'Use ?includeEnded=true to include organizations with rosteringEnded timestamp. ' +
        'Use ?embed=counts to include aggregated statistics (users, schools, classes).',
    },
  },
  { pathPrefix: '/districts' },
);
