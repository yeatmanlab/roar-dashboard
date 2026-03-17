import { initContract } from '@ts-rest/core';
import { SchoolsListQuerySchema, SchoolsListResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

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
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List schools',
      description:
        'Returns a paginated list of schools the authenticated user has access to. ' +
        'Super admins can access all schools. Regular users only see schools they belong to. ' +
        'Use ?includeEnded=true to include organizations with rosteringEnded timestamp. ' +
        'Use ?embed=counts to include aggregated statistics (users, classes).',
    },
  },
  { pathPrefix: '/schools' },
);
