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
 * Schema for a run abort event.
 *
 * Represents an event that marks a run as aborted.
 * - type: Must be 'abort' (literal type for discriminated union)
 * - reason: Optional reason for the abort
 */
export const RunAbortEventSchema = z.object({
  type: z.literal('abort'),
  reason: z.string().min(1).optional(),
});
/**
 * Schema for a run trial interaction event.
 *
 * - event: The type of interaction (e.g., "blur", "focus")
 * - trial_id: The ID of the trial associated with the interaction
 * - time_ms: The time in milliseconds since the start of the trial
 */
export const RunTrialInteractionSchema = z.object({
  event: z.string().min(1),
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
      assessment_stage: z.string().min(1),
      correct: z.boolean(),
    })
    .passthrough(), // allow app-specific
  interactions: z.array(RunTrialInteractionSchema).optional(),
});
/**
 * Schema for a run engagement event.
 *
 * Represents an event that marks a run engagement.
 * - type: Must be 'engagement' (literal type for discriminated union)
 * - engagement_flags: Engagement flags
 * - reliable_run: Whether the engagement is reliable
 */
export const RunEngagementEventSchema = z.object({
  type: z.literal('engagement'),
  engagement_flags: z.record(z.boolean()),
  reliable_run: z.boolean(),
});

/**
 * Discriminated union schema for run events.
 */
export const RunEventBodySchema = z.discriminatedUnion('type', [
  RunCompleteEventSchema,
  RunAbortEventSchema,
  RunTrialEventSchema,
  RunEngagementEventSchema,
]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;
