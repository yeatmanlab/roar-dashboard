import { z } from 'zod';

/**
 * Request body for POST /runs
 */
export const CreateRunRequestBodySchema = z.object({
  task_variant_id: z.string().uuid(),
  task_version: z.string(),
  administration_id: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRunRequestBody = z.infer<typeof CreateRunRequestBodySchema>;

/**
 * Response payload for POST /runs
 */
export const CreateRunResponseSchema = z.object({
  run_id: z.string().uuid(),
});

export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
