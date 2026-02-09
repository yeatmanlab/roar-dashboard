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

/**
 * Schema for a run completion event.
 *
 * Represents an event that marks a run as complete.
 * - type: Must be 'complete' (literal type for discriminated union)
 * - metadata: Optional metadata about the completion (e.g., final score, session info)
 */
export const RunCompleteEventSchema = z.object({
  type: z.literal('complete'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Discriminated union schema for run events.
 */
export const RunEventBodySchema = z.discriminatedUnion('type', [RunCompleteEventSchema]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;
