import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';

const c = initContract();

/**
 * Contract for the /classes endpoints.
 * Provides access to classes the authenticated user can view.
 */
export const ClassesContract = c.router(
  {
    listUsers: {
      method: 'GET',
      path: '/:classId/users',
      pathParams: z.object({ classId: z.string().uuid() }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get class users by classId',
      description:
        'Returns a paginated list of active users in a class. ' +
        'Filters users by role and grade if provided. ' +
        'Returns 403 if the user lacks permission to access the class. ' +
        'Returns 404 if the class does not exist.',
    },
  },
  { pathPrefix: '/classes' },
);
