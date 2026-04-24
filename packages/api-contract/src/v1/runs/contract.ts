import { initContract } from '@ts-rest/core';
import { CreateRunRequestBodySchema, CreateRunResponseSchema, RunEventBodySchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { z } from 'zod';

const c = initContract();

/**
 * Contract for the /user/:userId/runs and /user/:userId/runs/:runId/event endpoints.
 *
 * All endpoints are user-scoped: the userId path parameter must match the authenticated user
 * OR the user must have CAN_READ_CHILD permission (e.g., parent/guardian access).
 *
 * Creates a new run session instance and returns a run_id.
 * Posts an event to a run session instance.
 */
export const RunsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      pathParams: z.object({ userId: z.string().uuid() }),
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
        'Creates a new run owned by the specified user and returns the run id. ' +
        'The userId path parameter must match the authenticated user (strict ownership — no parent/guardian bypass). ' +
        'Supports anonymous runs which skip administration validation. ' +
        'Returns 422 if the provided task variant or administration IDs are invalid or cannot be resolved. ' +
        'Returns 403 if the user lacks access to the provided administration context or does not own the target user.',
    },
    event: {
      method: 'POST',
      path: '/:runId/event',
      pathParams: z.object({ userId: z.string().uuid(), runId: z.string().uuid() }),
      body: RunEventBodySchema,
      responses: {
        200: SuccessEnvelopeSchema(z.object({ status: z.literal('ok') })),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Post run event',
      description:
        'Posts an event to an existing run. ' +
        'The userId path parameter must match the authenticated user (strict ownership — no parent/guardian bypass). ' +
        'Supports four event types: complete (marks run as finished), abort (marks run as aborted), ' +
        'trial (records a trial with optional interactions), and engagement (updates reliability flags). ' +
        'Returns 404 if the run does not exist. ' +
        'Returns 403 if the authenticated user does not own the run. ' +
        'Returns 409 if the run is already in a terminal state (completed or aborted).',
    },
  },
  { pathPrefix: '/user/:userId/runs' },
);
