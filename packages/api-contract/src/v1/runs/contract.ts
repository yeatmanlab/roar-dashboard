import { initContract } from '@ts-rest/core';
import { CreateRunRequestBodySchema, CreateRunResponseSchema } from './schema';
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
      body: CreateRunRequestBodySchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateRunResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create run',
      description:
        'Creates a new run owned by the authenticated user and returns run_id. ' +
        'Returns 422 if the provided task variant or administration IDs are invalid or cannot be resolved. ' +
        'Returns 403 if the user lacks access to the provided administration context.',
    },
  },
  { pathPrefix: '/runs' },
);
