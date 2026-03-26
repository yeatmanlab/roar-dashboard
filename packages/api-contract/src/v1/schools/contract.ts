import { initContract } from '@ts-rest/core';
import {
  SchoolsListQuerySchema,
  SchoolsListResponseSchema,
  SchoolDetailSchema,
  GetSchoolPathParamSchema,
} from './schema';
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
    get: {
      method: 'GET',
      path: '/:schoolId',
      pathParams: GetSchoolPathParamSchema,
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
        'Returns 401 if the requesting user is not authenticated. ' +
        'Returns 403 if the requesting user lacks permission to access the school. ' +
        'Returns 404 if the requested school does not exist.',
    },
  },
  { pathPrefix: '/schools' },
);
