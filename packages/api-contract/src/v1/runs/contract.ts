import { initContract } from '@ts-rest/core';
import { StartRunRequestBodySchema, StartRunResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /runs endpoints.
 * Creates a new run session instance and returns a run_id.
 */
export const RunsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: StartRunRequestBodySchema,
      responses: {
        201: SuccessEnvelopeSchema(StartRunResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create run',
      description:
        'Creates a new run (assessment session instance) owned by the authenticated user and returns run_id. ' +
        'Returns 404 if the task variant or administration does not exist. ' +
        'Returns 403 if the user lacks access to the provided administration context.',
    },
  },
  { pathPrefix: '/runs' },
);
