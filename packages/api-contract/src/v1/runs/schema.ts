import { z } from 'zod';
import { JsonValue, parseJsonB } from '../common/parse-jsonb';

/**
 * Request body for POST /runs
 */
export const CreateRunRequestBodySchema = z.object({
  task_variant_id: z.string().uuid(),
  task_version: z.string(),
  administration_id: z.string().uuid(),
  metadata: JsonValue.optional().superRefine((metadata, ctx) => {
    if (!metadata) return;
    parseJsonB(metadata, ctx);
  }),
});

export type CreateRunRequestBody = z.infer<typeof CreateRunRequestBodySchema>;

/**
 * Response payload for POST /runs
 */
export const CreateRunResponseSchema = z.object({
  run_id: z.string().uuid(),
});

/**
 * Schema for a run completion event.
 *
 * Represents an event that marks a run as complete.
 * - type: Must be 'complete' (literal type for discriminated union)
 * - metadata: Optional metadata about the completion (e.g., final score, session info)
 */
export const RunCompleteEventSchema = z.object({
  type: z.literal('complete'),
  metadata: JsonValue.optional().superRefine((metadata, ctx) => {
    if (!metadata) return;
    parseJsonB(metadata, ctx);
  }),
});

/**
 * Discriminated union schema for run events.
 */
export const RunEventBodySchema = z.discriminatedUnion('type', [RunCompleteEventSchema]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
