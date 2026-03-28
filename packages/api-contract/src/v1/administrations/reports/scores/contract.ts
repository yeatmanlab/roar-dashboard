import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ScoreOverviewQuerySchema, ScoreOverviewResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../../../response';

const c = initContract();

/**
 * Contract for score report endpoints.
 * These are sub-resources of an administration at /administrations/:administrationId/reports/scores.
 */
export const ScoreReportsContract = c.router(
  {
    getOverview: {
      method: 'GET',
      path: '/:administrationId/reports/scores/overview',
      pathParams: z.object({ administrationId: z.string().uuid() }),
      query: ScoreOverviewQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(ScoreOverviewResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get score overview for an administration',
      description:
        'Returns aggregated support level distributions per task for all students in scope. ' +
        'Not paginated — aggregates across the full population. ' +
        'Requires Reports.Score.READ permission and a supervisory role.',
    },
  },
  { pathPrefix: '/administrations' },
);
