import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { TaskVariantCreateRequestSchema, TaskVariantCreateResponseSchema } from './schema';

const c = initContract();

export const TasksContract = c.router({
  createTaskVariant: {
    method: 'POST',
    path: '/:taskId/variants',
    pathParams: z.object({
      taskId: z.string().uuid(),
    }),
    contentType: 'application/json',
    body: TaskVariantCreateRequestSchema,
    responses: {
      201: SuccessEnvelopeSchema(TaskVariantCreateResponseSchema),
      400: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
    summary: 'Create a new task variant',
    description:
      'Create a new task variant for a given task. ' +
      'The request includes an array of task-variant parameters, each with a name and a value. ' +
      'A successful response returns a 201 with status created.',
  },
});
