import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  DistrictsListQuerySchema,
  DistrictsListResponseSchema,
  DistrictGetQuerySchema,
  DistrictGetResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Districts API Contract
 *
 * Provides endpoints for managing district organizations.
 */
export const DistrictsContract = c.router(
  {
    /**
     * List districts with optional filtering and embedding.
     */
    list: {
      method: 'GET',
      path: '/',
      query: DistrictsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(DistrictsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List districts',
      description:
        'Returns a paginated list of districts the authenticated user has access to. ' +
        'Super admins can access all districts. Regular users only see districts they belong to. ' +
        'Use ?includeEnded=true to include organizations with rosteringEnded timestamp. ' +
        'Use ?embed=counts to include aggregated statistics (users, schools, classes).',
    },

    /**
     * Get a single district by ID with optional embedding.
     */
    getById: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({
        id: z.string().uuid(),
      }),
      query: DistrictGetQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(DistrictGetResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get district by ID',
      description: 'Retrieve detailed information for a specific district by ID with optional child embedding',
    },
  },
  { pathPrefix: '/districts' },
);
