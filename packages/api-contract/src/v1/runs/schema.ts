import { z } from 'zod';

/**
 * Request body for POST /runs
 */
export const StartRunRequestBodySchema = z.object({
  task_variant_id: z.string().uuid(),
  task_version: z.string().min(1),
  administration_id: z.string().uuid(), // make it required for now
  metadata: z.record(z.unknown()).optional(),
});

export type StartRunRequestBody = z.infer<typeof StartRunRequestBodySchema>;

/**
 * Response payload for POST /runs
 */
export const StartRunResponseSchema = z.object({
  run_id: z.string().uuid(),
});

export type StartRunResponse = z.infer<typeof StartRunResponseSchema>;
