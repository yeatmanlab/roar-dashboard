import { initContract } from '@ts-rest/core';
import { StartRunRequestBodySchema, StartRunResponseSchema, RunEventBodySchema } from './schema';
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
      description: 'Currently supports type="complete" (finishRun).',
    },
  },
  { pathPrefix: '/runs' },
);
