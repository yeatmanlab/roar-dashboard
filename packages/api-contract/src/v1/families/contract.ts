import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  AddFamilyChildrenRequestSchema,
  AddFamilyChildrenResponseSchema,
  CreateFamilyRequestSchema,
  CreateFamilyResponseSchema,
  EnrolledFamilyUsersQuerySchema,
  EnrolledFamilyUsersResponseSchema,
} from './schema';

const c = initContract();

/**
 * Contract for the /families endpoints.
 * Provides access to families the authenticated user can view.
 */
export const FamiliesContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: CreateFamilyRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateFamilyResponseSchema),
        400: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Register a new caretaker and create their family',
      description:
        'Public ROAR@Home registration endpoint. Atomically creates a Firebase Auth account, ' +
        'a caregiver user, a new family with `created_by` set to the caregiver, a `user_families` row ' +
        'linking the two with role=parent, and a `rostering_provider_ids` row with provider=dashboard. ' +
        'A given caregiver may only ever create one family (enforced by a partial unique index on ' +
        'families.created_by) but may join many. ' +
        'Returns 201 with the new family id. ' +
        'Returns 400 for malformed request bodies. ' +
        'Returns 409 if the email is already in use (in `users` or Firebase Auth). ' +
        'Returns 422 if the caregiver has already created a family. ' +
        'Returns 429 if Firebase Auth rate-limits the create. ' +
        'Returns 500 for unexpected errors (Firebase compensation runs; no orphaned records).',
    },
    listUsers: {
      method: 'GET',
      path: '/:familyId/users',
      pathParams: z.object({ familyId: z.string().uuid() }),
      query: EnrolledFamilyUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledFamilyUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get family users by familyId',
      description:
        'Returns a paginated list of active users in a family. ' +
        'Filters users by role and grade if provided. ' +
        'Returns 403 if the user lacks permission to access the family. ' +
        'Returns 404 if the family does not exist.',
    },
    addChildren: {
      method: 'POST',
      path: '/:familyId/users',
      pathParams: z.object({ familyId: z.string().uuid() }),
      body: AddFamilyChildrenRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(AddFamilyChildrenResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        429: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Add one or more children to an existing family',
      description:
        'Authenticated endpoint for caretakers (or super admins) to add children to an ' +
        'existing family. Each child gets a Firebase Auth account, a `users` row with ' +
        'userType=student / authProvider=[password], a `user_families` row with role=child, ' +
        "a `user_groups` row for the group resolved from the child's activation code, and a " +
        '`rostering_provider_ids` row with provider=dashboard and partnerId=familyId. ' +
        'All DB writes commit atomically; on failure, every Firebase Auth account created in ' +
        'this request is rolled back. ' +
        'Returns 201 with the new child ids in request order. ' +
        'Returns 400 for malformed request bodies. ' +
        'Returns 401 if the caller is not authenticated. ' +
        'Returns 403 if the caller is neither a parent of the target family nor a super admin. ' +
        'Returns 404 if the familyId does not exist. ' +
        'Returns 409 if any child email is already in use. ' +
        'Returns 422 if an activation code is invalid/expired or the family-size cap (12) is exceeded. ' +
        'Returns 429 if Firebase Auth rate-limits any createUser call. ' +
        'Returns 500 for unexpected errors (Firebase compensation runs; no orphaned records).',
    },
  },
  { pathPrefix: '/families' },
);
