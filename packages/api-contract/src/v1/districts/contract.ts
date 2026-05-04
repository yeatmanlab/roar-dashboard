import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  CreateDistrictRequestSchema,
  CreateDistrictResponseSchema,
  DistrictsListQuerySchema,
  DistrictsListResponseSchema,
  DistrictDetailSchema,
  DistrictSchoolsListQuerySchema,
  DistrictSchoolsListResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';

const c = initContract();

/**
 * Contract for the /districts endpoints.
 * Provides access to districts the authenticated user can view.
 */
export const DistrictsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: CreateDistrictRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateDistrictResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a district',
      description:
        'Creates a new district (top-level org). ' +
        'Districts are the root of the org hierarchy — they have no parent and their `path` ltree is computed from the new district id by a database trigger. ' +
        'Restricted to super admins. ' +
        'Returns 201 with the new district id. ' +
        'Returns 400 if the request body is missing or contains invalid field values. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 500 if an internal server error occurs.',
    },
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
    get: {
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
    listSchools: {
      method: 'GET',
      path: '/:districtId/schools',
      pathParams: z.object({
        districtId: z.string().uuid(),
      }),
      query: DistrictSchoolsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(DistrictSchoolsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List schools in a district',
      description:
        'Returns a paginated list of schools within the specified district. ' +
        'Super admins see all schools in the district. ' +
        'Supervisory users (administrator, teacher) see only schools in their accessible org tree. ' +
        'Supervised users (student, guardian, parent, relative) receive 403 Forbidden. ' +
        'Returns 403 if the user lacks permission to access the district. ' +
        'Returns 404 if the district does not exist.',
    },
    listUsers: {
      method: 'GET',
      path: '/:districtId/users',
      pathParams: z.object({ districtId: z.string().uuid() }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get district users by districtId',
      description:
        'Returns a paginated list of active users in a district. ' +
        'Filters users by role and grade if provided. ' +
        'Returns 403 if the user lacks permission to access the district. ' +
        'Returns 404 if the district does not exist.',
    },
  },
  { pathPrefix: '/districts' },
);
