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
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get current user profile',
      description:
        'Returns the authenticated user profile including id, userType, name, and unsigned TOS agreements. ' +
        'The unsignedAgreements array contains TOS agreements the user must sign before using the platform. ' +
        'Each agreement includes all current locale variants so the frontend can present the appropriate one. ' +
        'Returns 401 if not authenticated. Returns 404 if the user record is not found.',
    },
  },
  { pathPrefix: '/me' },
);
