import { initContract } from '@ts-rest/core';
import { CreateRunRequestBodySchema, CreateRunResponseSchema, RunEventBodySchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { z } from 'zod';

const c = initContract();

/**
 * Contract for the /runs and /runs/:runId/event endpoints.
 * Creates a new run session instance and returns a run_id.
 * Posts an event to a run session instance.
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
    event: {
      method: 'POST',
      path: '/:runId/event',
      pathParams: z.object({ runId: z.string().uuid() }),
      body: RunEventBodySchema,
      responses: {
        200: SuccessEnvelopeSchema(z.object({ status: z.literal('ok') })),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Post run event',
      description: 'Currently supports events',
    },
  },
  { pathPrefix: '/runs' },
);
