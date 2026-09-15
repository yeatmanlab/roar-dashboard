import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GuardianStudentReportResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../../../response';

const c = initContract();

/**
 * Contract for guardian / longitudinal student report endpoints.
 * Nested under UsersContract — the parent provides the /users pathPrefix.
 */
export const GuardianStudentReportContract = c.router({
  getGuardianStudentReport: {
    method: 'GET',
    path: '/:userId/reports/scores',
    pathParams: z.object({
      userId: z.string().uuid(),
    }),
    responses: {
      200: SuccessEnvelopeSchema(GuardianStudentReportResponseSchema),
      400: ErrorEnvelopeSchema,
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: "Get a student's longitudinal score report across all administrations",
    description:
      "Returns a single student's complete score history across every administration they " +
      'have started, completed, or remain assigned to. Includes per-administration task ' +
      'scores plus a top-level `longitudinalScores` map (keyed by task slug) for trend ' +
      'rendering.\n\n' +
      'Authorization combines four checks (super admins bypass all):\n' +
      '- Student must exist and not have `rosteringEnded` set (404 otherwise).\n' +
      '- Self-access is denied — students cannot view their own report (403).\n' +
      '- Guardians may only view a student they are linked to via `user_families` (parent → child).\n' +
      '- Supervisory roles may view any student whose org/class membership overlaps with their own ' +
      '  (the same scope-overlap test applied to other report endpoints). Without overlap: 403.\n\n' +
      'Status codes:\n' +
      '- 200: Report returned\n' +
      '- 400: Invalid path parameters (e.g., malformed userId)\n' +
      '- 401: Missing or invalid authentication token\n' +
      '- 403: Self-access, guardian not linked, supervised role, or supervisory user without org overlap\n' +
      '- 404: Student not found, or rostering-ended\n' +
      '- 500: Internal server error',
  },
});
