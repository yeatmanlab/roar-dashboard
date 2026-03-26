import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { UserResponseSchema } from './schema';

const c = initContract();

/**
 * Contract for the /users endpoints.
 * Provides access to user related data that an authenticated user can view.
 */
export const UsersContract = c.router(
  {
    get: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: SuccessEnvelopeSchema(UserResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get a user by ID',
      description:
        'Returns a single user by their ID. ' +
        ' Returns a 401 if the requesting user is not authenticated. ' +
        ' Returns a 403 if the requesting user is not authorized to view the requested user. ' +
        ' Returns a 404 if the requested user is not found. ' +
        ' Returns a 500 if an internal server error occurs.',
    },
  },
  { pathPrefix: '/users' },
);
