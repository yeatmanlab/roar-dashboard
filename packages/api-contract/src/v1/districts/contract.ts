import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { DistrictsListQuerySchema, DistrictsListResponseSchema, DistrictDetailSchema } from './schema';
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
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List districts',
      description:
        'Returns a paginated list of districts the authenticated user has access to. ' +
        'Super admins can access all districts. Regular users only see districts they belong to. ' +
        'Unauthorized users receive an empty result set (not a 403 error). ' +
        'Use ?includeEnded=true to include organizations with rosteringEnded timestamp. ' +
        'Use ?embed=counts to include aggregated statistics (users, schools, classes).',
    },
    getById: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({
        id: z.string().uuid(),
      }),
      responses: {
        200: SuccessEnvelopeSchema(DistrictDetailSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get district by ID',
      description:
        'Returns a single district by ID. ' +
        'Super admins can access any district. Regular users can only access districts they belong to.',
    },
  },
  { pathPrefix: '/districts' },
);
