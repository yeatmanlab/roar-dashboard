import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ScoreOverviewQuerySchema,
  ScoreOverviewResponseSchema,
  StudentScoresQuerySchema,
  StudentScoresResponseSchema,
  IndividualStudentReportQuerySchema,
  IndividualStudentReportResponseSchema,
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
  getIndividualStudentReport: {
    method: 'GET',
    path: '/:id/reports/scores/students/:userId',
    pathParams: z.object({
      id: z.string().uuid(),
      userId: z.string().uuid(),
    }),
    query: IndividualStudentReportQuerySchema,
    responses: {
      200: SuccessEnvelopeSchema(IndividualStudentReportResponseSchema),
      400: ErrorEnvelopeSchema,
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: "Get a single student's detailed score report for an administration",
    description:
      "Returns a single student's complete score report for one administration: " +
      'header context (student info, administration metadata), per-task entries with ' +
      'all score types, support level, tags, subscores (PA/phonics), skillsToWorkOn (PA), ' +
      'and chronological historical scores from prior administrations up to and ' +
      'including the current one.\n\n' +
      'Authorization is the same two-FGA-check pattern as the score overview ' +
      '(can_read_scores on administration, then on the requested scope) plus a third ' +
      'check that the target student is in the requested scope. Students whose ' +
      '`rosteringEnded` is set are treated as not-found (404).\n\n' +
      'Status codes:\n' +
      '- 200: Student report returned\n' +
      '- 400: Invalid scope or invalid path/query parameters\n' +
      '- 401: Missing or invalid authentication token\n' +
      '- 403: User lacks can_read_scores at the requested administration or scope level\n' +
      '- 404: Administration not found, or student not in scope (or rostering-ended)\n' +
      '- 500: Internal server error',
  },
});
