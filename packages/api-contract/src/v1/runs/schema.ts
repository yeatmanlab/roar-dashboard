import { z } from 'zod';
import { JsonValue, parseJsonB } from '../common/parse-jsonb';

export const allowEngagementFlagEnum = z.enum([
  'incomplete',
  'response_time_too_fast',
  'accuracy_too_low',
  'not_enough_responses',
]);

export const runEventTypeEnum = z.enum(['complete', 'abort', 'trial', 'engagement']);

/**
 * Request body for POST /runs
 */
export const CreateRunRequestBodySchema = z.object({
  taskVariantId: z.string().uuid(),
  taskVersion: z.string(),
  administrationId: z.string().uuid(),
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
  runId: z.string().uuid(),
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
});
/**
 * Schema for a run trial interaction event.
 *
 * - event: The type of interaction (e.g., "blur", "focus")
 * - trialId: The ID of the trial associated with the interaction
 * - timeMs: The time in milliseconds since the start of the trial
 */
export const RunTrialInteractionSchema = z.object({
  event: z.enum(['blur', 'focus', 'fullscreen_enter', 'fullscreen_exit']),
  trialId: z.number().int().nonnegative(),
  timeMs: z.number().int().nonnegative(),
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
      assessmentStage: z.enum(['practice', 'test']),
      correct: z.number().int().min(0).max(1),
    })
    .passthrough(), // allow app-specific
  interactions: z.array(RunTrialInteractionSchema).optional(),
});

/**
 * Schema for a run engagement event.
 *
 * Represents an event that marks a run engagement.
 * - type: Must be 'engagement' (literal type for discriminated union)
 * - engagementFlags: Engagement flags
 * - reliableRun: Whether the engagement is reliable
 */
export const RunEngagementEventSchema = z.object({
  type: z.literal('engagement'),
  engagementFlags: z.record(allowEngagementFlagEnum),
  reliableRun: z.boolean(),
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
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;
