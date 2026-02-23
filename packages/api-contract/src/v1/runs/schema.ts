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
 * Schema for a run abort event.
 *
 * Represents an event that marks a run as aborted.
 * - type: Must be 'abort' (literal type for discriminated union)
 * - abortedAt: The time the run was aborted
 */
export const RunAbortEventSchema = z.object({
  type: z.literal('abort'),
  abortedAt: z.date(),
});
/**
 * Schema for a run trial interaction event.
 *
 * - event: The type of interaction (e.g., "blur", "focus")
 * - trial_id: The ID of the trial associated with the interaction
 * - time_ms: The time in milliseconds since the start of the trial
 */
export const RunTrialInteractionSchema = z.object({
  event: z.enum(['blur', 'focus', 'fullscreen_enter', 'fullscreen_exit']),
  trial_id: z.number().int().nonnegative(),
  time_ms: z.number().int().nonnegative(),
});
/**
 * Schema for a run write trial event.
 *
 * Represents an event that writes a trial.
 * - type: Must be 'trial' (literal type for discriminated union)
 * - trial: The trial data
 * - interactions: Optional array of trial interactions
 */
export const RunTrialEventSchema = z.object({
  type: z.literal('trial'),
  trial: z
    .object({
      assessment_stage: z.enum(['practice', 'test']),
      correct: z.number().int().min(0).max(1),
    })
    .passthrough(), // allow app-specific
  interactions: z.array(RunTrialInteractionSchema).optional(),
});

/**
 * Discriminated union schema for run events.
 */
export const RunEventBodySchema = z.discriminatedUnion('type', [
  RunCompleteEventSchema,
  RunAbortEventSchema,
  RunTrialEventSchema,
]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
