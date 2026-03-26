import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { SchoolsListQuerySchema, SchoolsListResponseSchema, SchoolDetailSchema, SCHOOL_EMBED_OPTIONS } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { createEmbedQuerySchema } from '../common/query';

const c = initContract();

/**
 * Contract for the /schools endpoints.
 * Provides access to schools the authenticated user can view.
 */
export const SchoolsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: SchoolsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(SchoolsListResponseSchema),
        401: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List schools',
      description:
        'Returns a paginated list of schools the authenticated user has access to. ' +
        'Super admins can access all schools. Regular users only see schools they belong to. ' +
        'Unauthorized users receive an empty result set (not a 403 error). ' +
        'Use ?includeEnded=true to include organizations with rosteringEnded timestamp. ' +
        'Use ?embed=counts to include aggregated statistics (users, classes).',
    },
    getById: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({
        id: z.string().uuid(),
      }),
      query: createEmbedQuerySchema(SCHOOL_EMBED_OPTIONS),
      responses: {
        200: SuccessEnvelopeSchema(SchoolDetailSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get school by ID',
      description:
        'Returns a single school by ID. ' +
        'Returns 403 if the user lacks permission to access the school. ' +
        'Returns 404 if the school does not exist. ' +
        'Use ?embed=counts to include aggregated statistics (users, classes).',
    },
  },
  { pathPrefix: '/schools' },
);
