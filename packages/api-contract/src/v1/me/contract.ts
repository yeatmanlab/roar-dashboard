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
        // Emitted by AuthGuardMiddleware for a user whose rostering has ended
        // (`auth/rostering-ended`). Declared so the typed client has a 403 branch.
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get current user profile',
      description:
        'Returns the authenticated user profile including id, userType, name, unsigned TOS agreements, and family memberships. ' +
        'The unsignedAgreements array contains TOS agreements the user must sign before using the platform. ' +
        'Each agreement includes all current locale variants so the frontend can present the appropriate one. ' +
        "The families array contains the caller's own active family memberships as { id, role } so the parent dashboard can resolve its family id and route on the family role. " +
        'Returns 401 if not authenticated. ' +
        'Returns 403 if the caller is authenticated but their rostering has ended. ' +
        'Returns 404 if the user record is not found.',
    },
  },
  { pathPrefix: '/me' },
);
