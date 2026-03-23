import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ProgressStudentsQuerySchema, ProgressStudentsResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../../response';

const c = initContract();

/**
 * Contract for progress report endpoints.
 * These are sub-resources of an administration at /administrations/:administrationId/reports/progress.
 */
export const ProgressReportsContract = c.router(
  {
    listStudents: {
      method: 'GET',
      path: '/:administrationId/reports/progress/students',
      pathParams: z.object({ administrationId: z.string().uuid() }),
      query: ProgressStudentsQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(ProgressStudentsResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List student progress for an administration',
      description:
        'Returns a paginated table of students with per-task completion status ' +
        '(assigned, started, completed, optional), scoped to a specific org/class/group. ' +
        'Requires report access and a supervisory role on the administration.',
    },
  },
  { pathPrefix: '/administrations' },
);
