import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  CreateSchoolRequestSchema,
  CreateSchoolResponseSchema,
  SchoolsListQuerySchema,
  SchoolsListResponseSchema,
  SchoolDetailSchema,
  SchoolClassesListQuerySchema,
  SchoolClassesListResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';

const c = initContract();

/**
 * Contract for the /schools endpoints.
 * Provides access to schools the authenticated user can view.
 */
export const SchoolsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: CreateSchoolRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateSchoolResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a school',
      description:
        'Creates a new school under an existing district. ' +
        'The parent districtId lives in the request body, not the URL — every canonical resource on this API sits at the top level. ' +
        "The school's ltree path is computed from the parent district's path by a database trigger. " +
        'Restricted to super admins. ' +
        'Returns 201 with the new school id. ' +
        'Returns 400 if the request body is missing or contains invalid field values. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 422 if districtId is well-formed but does not resolve to an active district (no row, wrong orgType, or rosteringEnded set in the past). ' +
        'Returns 500 if an internal server error occurs.',
    },
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
      pathParams: z.object({
        schoolId: z.string().uuid(),
      }),
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
    listClasses: {
      method: 'GET',
      path: '/:schoolId/classes',
      pathParams: z.object({
        schoolId: z.string().uuid(),
      }),
      query: SchoolClassesListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(SchoolClassesListResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List classes in a school',
      description:
        'Returns a paginated list of active classes within a school. ' +
        'Only active classes (rosteringEnded IS NULL) are returned. ' +
        'Requires authentication and supervisory role on the school. ' +
        'Returns 400 if the query parameters are invalid. ' +
        'Returns 401 if the requesting user is not authenticated. ' +
        'Returns 403 if the requesting user lacks permission to access the school. ' +
        'Returns 404 if the requested school does not exist. ' +
        'Returns 500 for unexpected server errors.',
    },
    listUsers: {
      method: 'GET',
      path: '/:schoolId/users',
      pathParams: z.object({
        schoolId: z.string().uuid(),
      }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List users in a school',
      description:
        'Returns a paginated list of users enrolled in a school. ' +
        'Requires authentication and supervisory role on the school. ' +
        'Returns 403 if the requesting user lacks permission to access the school. ' +
        'Returns 404 if the requested school does not exist.',
    },
  },
  { pathPrefix: '/schools' },
);
