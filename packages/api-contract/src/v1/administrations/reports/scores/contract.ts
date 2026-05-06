import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ReportScopeQuerySchema } from '../common';
import { ScoreOverviewQuerySchema, ScoreOverviewResponseSchema, ScoreFacetsResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../../../response';

const c = initContract();

/**
 * Contract for score report endpoints.
 * Nested under AdministrationsContract — the parent provides the /administrations pathPrefix.
 */
export const ScoreReportsContract = c.router({
  getOverview: {
    method: 'GET',
    path: '/:id/reports/scores/overview',
    pathParams: z.object({ id: z.string().uuid() }),
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
      'Scoped to a specific org, class, or group via scopeType/scopeId.\n\n' +
      'Status codes:\n' +
      '- 200: Aggregated statistics returned successfully\n' +
      '- 400: Invalid scope (scopeId not assigned to this administration)\n' +
      '- 401: Missing or invalid authentication token\n' +
      '- 403: User lacks can_read_scores at the requested administration or scope level\n' +
      '- 404: Administration not found\n' +
      '- 500: Internal server error',
  },
  getScoreFacets: {
    method: 'GET',
    path: '/:id/reports/scores/facets',
    pathParams: z.object({ id: z.string().uuid() }),
    query: ReportScopeQuerySchema,
    responses: {
      200: SuccessEnvelopeSchema(ScoreFacetsResponseSchema),
      400: ErrorEnvelopeSchema,
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: 'Get score distribution facets for an administration',
    description:
      'Returns aggregated support level, raw score, and percentile distributions per task for all students in scope. ' +
      'Includes grade-level and school-level aggregations. ' +
      'Not paginated — aggregates across the full population. ' +
      'Scoped to a specific org, class, or group via scopeType/scopeId.\n\n' +
      'Status codes:\n' +
      '- 200: Aggregated statistics returned successfully\n' +
      '- 400: Invalid scope (scopeId not assigned to this administration)\n' +
      '- 401: Missing or invalid authentication token\n' +
      '- 403: User lacks can_read_scores at the requested administration or scope level\n' +
      '- 404: Administration not found\n' +
      '- 500: Internal server error',
  },
});
