import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ProgressStudentsQuerySchema,
  ProgressStudentsResponseSchema,
  ProgressOverviewQuerySchema,
  ProgressOverviewResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../../../response';

const c = initContract();

/**
 * Contract for progress report endpoints.
 * Nested under AdministrationsContract — the parent provides the /administrations pathPrefix.
 */
export const ProgressReportsContract = c.router({
  getStudentProgress: {
    method: 'GET',
    path: '/:id/reports/progress/students',
    pathParams: z.object({ id: z.string().uuid() }),
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
    summary: 'Get student progress for an administration',
    description:
      'Returns paginated per-student progress for an administration, showing ' +
      'completion status (assigned, started, completed, optional) for each task. ' +
      'Results are scoped to a specific org, class, or group via scopeType/scopeId.',
  },
  getProgressOverview: {
    method: 'GET',
    path: '/:id/reports/progress/overview',
    pathParams: z.object({ id: z.string().uuid() }),
    query: ProgressOverviewQuerySchema,
    responses: {
      200: SuccessEnvelopeSchema(ProgressOverviewResponseSchema),
      400: ErrorEnvelopeSchema,
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: 'Get progress overview for an administration',
    description:
      'Returns aggregated completion statistics for each task in an administration, ' +
      'scoped to a specific org, class, or group via scopeType/scopeId. ' +
      'Includes per-task breakdowns of assigned, started, completed, and optional counts.',
  },
});
