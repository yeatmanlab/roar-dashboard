import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ScoreOverviewQuerySchema,
  ScoreOverviewResponseSchema,
  StudentScoresQuerySchema,
  StudentScoresResponseSchema,
} from './schema';
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
  listStudents: {
    method: 'GET',
    path: '/:id/reports/scores/students',
    pathParams: z.object({ id: z.string().uuid() }),
    query: StudentScoresQuerySchema,
    responses: {
      200: SuccessEnvelopeSchema(StudentScoresResponseSchema),
      400: ErrorEnvelopeSchema,
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: 'List per-student scores for an administration',
    description:
      'Returns paginated per-student score data for an administration, scoped to a ' +
      'specific org, class, or group via scopeType/scopeId. ' +
      'Each row includes per-task scores (rawScore, percentile, standardScore, supportLevel) ' +
      'plus reliability and engagement flags.\n\n' +
      'Sorting and filtering accept dynamic `scores.<taskId>.<field>` fields in addition to ' +
      'static user fields. Task IDs in dynamic fields are validated against the administration ' +
      'and return 400 if unknown. Sorting by support level uses a per-variant SQL CASE ' +
      "expression built from the scoring config's resolved cutoffs.\n\n" +
      'Filter behavior notes:\n' +
      '- `supportLevel:eq:optional` and `supportLevel:in:...,optional,...` are silently dropped ' +
      'from SQL filtering — `optional` is not a classifiable support level, it depends on ' +
      'per-student condition evaluation rather than score values, and has no SQL representation. ' +
      'The request still returns 200 with the unfiltered (or only-the-other-values-filtered) page; ' +
      'no warning is surfaced. Treat `optional` as a post-fetch client-side filter.\n' +
      '- Multiple `taskId:in:<uuid>` filter entries are merged into a single allow-list ' +
      '(unioned). Other filter fields combine via AND across entries.\n\n' +
      'Status codes:\n' +
      '- 200: Paginated student score rows returned\n' +
      '- 400: Invalid scope, unknown task ID in sort/filter, or invalid filter\n' +
      '- 401: Missing or invalid authentication token\n' +
      '- 403: User lacks can_read_scores at the requested administration or scope level\n' +
      '- 404: Administration not found\n' +
      '- 500: Internal server error',
  },
});
