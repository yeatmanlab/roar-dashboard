import { initContract } from '@ts-rest/core';
import { MeSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /me endpoint.
 * Returns the authenticated user's profile information.
 */
export const MeContract = c.router(
  {
    get: {
      method: 'GET',
      path: '/',
      responses: {
        200: SuccessEnvelopeSchema(MeSchema),
        401: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get current user profile',
      description: 'Returns the authenticated user profile including id, userType, and name.',
    },
  },
  { pathPrefix: '/me' },
);
