import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';

const c = initContract();

/**
 * Contract for the /families endpoints.
 * Provides access to families the authenticated user can view.
 */
export const FamiliesContract = c.router(
  {
    listUsers: {
      method: 'GET',
      path: '/:familyId/users',
      pathParams: z.object({ familyId: z.string().uuid() }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
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
