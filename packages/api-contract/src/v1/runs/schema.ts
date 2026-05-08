import { z } from 'zod';
import { JsonValue, parseJsonB } from '../common/parse-jsonb';

export const RunEventTypeSchema = z.enum(['complete', 'abort', 'trial', 'engagement']);

export const AssessmentStageSchema = z.enum(['practice', 'test']);

export const RunTrialInteractionEventSchema = z.enum(['blur', 'focus', 'fullscreen_enter', 'fullscreen_exit']);

/**
 * Request body for POST /runs
 *
 * Supports two modes:
 * - **Standard run:** `administrationId` is required, `isAnonymous` is omitted or false.
 * - **Anonymous run:** `isAnonymous` is true, `administrationId` must not be provided.
 */
export const CreateRunRequestBodySchema = z
  .object({
    taskVariantId: z.string().uuid(),
    taskVersion: z.string(),
    administrationId: z.string().uuid().optional(),
    isAnonymous: z.boolean().default(false),
    metadata: JsonValue.optional().superRefine((metadata, ctx) => {
      if (!metadata) return;
      parseJsonB(metadata, ctx);
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.isAnonymous && !data.administrationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['administrationId'],
        message: 'administrationId is required for non-anonymous runs',
      });
    }

    if (data.isAnonymous && data.administrationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['administrationId'],
        message: 'administrationId must not be provided for anonymous runs',
      });
    }
  });

export type CreateRunRequestBody = z.infer<typeof CreateRunRequestBodySchema>;

/**
 * Response payload for POST /runs
 */
export const CreateRunResponseSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schema for a run completion event.
 *
 * Represents an event that marks a run as complete.
 * - type: Must be 'complete' (literal type for discriminated union)
 * - metadata: Optional metadata about the completion (e.g., final score, session info)
 */
export const RunCompleteEventSchema = z.object({
  type: z.literal(RunEventTypeSchema.enum.complete),
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
 */
export const RunAbortEventSchema = z.object({
  type: z.literal(RunEventTypeSchema.enum.abort),
});
/**
 * Schema for a run trial interaction event.
 *
 * - event: The type of interaction (e.g., "blur", "focus")
 * - timeMs: The time in milliseconds since the start of the trial
 */
export const RunTrialInteractionSchema = z.object({
  event: RunTrialInteractionEventSchema,
  timeMs: z.number().int().nonnegative(),
});
/**
 * Schema for a single score entry in a run-level scoring update.
 *
 * Mirrors the natural-key shape of `app.run_scores` on the backend. A trial event may
 * carry zero or more of these in its `scores` array; each entry upserts the
 * corresponding row keyed on `(run_id, type, domain, name, assessment_stage)`.
 *
 * - `type` — matches the `score_type` enum (`computed` or `raw`)
 * - `domain` — the assessment domain (e.g., `composite`)
 * - `name` — the score name within that domain (e.g., `thetaSE`, `numAttempted`)
 * - `value` — stored as text on the backend for flexibility (numeric strings, codes, etc.)
 * - `assessmentStage` — optional; omit for run-aggregate scores not tied to a stage
 * - `categoryScore` — optional flag for category-level aggregate scores
 */
export const ScoreEntrySchema = z.object({
  type: z.enum(['computed', 'raw']),
  domain: z.string().min(1),
  name: z.string().min(1),
  value: z.string(),
  assessmentStage: AssessmentStageSchema.optional(),
  categoryScore: z.boolean().optional(),
});

/**
 * Schema for a run write trial event.
 *
 * Represents an event that writes a trial.
 * - type: Must be 'trial' (literal type for discriminated union)
 * - trial: The trial data
 * - interactions: Optional array of trial interactions
 * - scores: Optional array of score snapshots produced by this trial; each entry
 *   upserts the corresponding row in `run_scores` by natural key in the same
 *   transaction as the trial write.
 */
export const RunTrialEventSchema = z.object({
  type: z.literal(RunEventTypeSchema.enum.trial),
  trial: z
    .object({
      assessmentStage: AssessmentStageSchema,
      correct: z.number().int().min(0).max(1),
    })
    .passthrough(), // allow app-specific
  interactions: z.array(RunTrialInteractionSchema).optional(),
  scores: z.array(ScoreEntrySchema).optional(),
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
  type: z.literal(RunEventTypeSchema.enum.engagement),
  engagementFlags: z
    .object({
      incomplete: z.boolean(),
      responseTimeTooFast: z.boolean(),
      accuracyTooLow: z.boolean(),
      notEnoughResponses: z.boolean(),
    })
    .partial(),
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
export type ScoreEntry = z.infer<typeof ScoreEntrySchema>;
