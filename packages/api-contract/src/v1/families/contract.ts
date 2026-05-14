import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
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
  },
  { pathPrefix: '/families' },
);
