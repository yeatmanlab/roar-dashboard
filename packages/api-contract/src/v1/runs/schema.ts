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
 * Score type enum. Mirrors `score_type` on the backend (`computed` or `raw`).
 */
export const ScoreTypeSchema = z.enum(['computed', 'raw']);

/**
 * Common fields shared by every score entry shape, regardless of `type`.
 * Kept private to this module — consumers should use `ScoreEntrySchema` (the
 * discriminated union) so the type-specific rules apply.
 */
const ScoreEntryBaseSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  value: z.string().min(1),
  categoryScore: z.boolean().optional(),
});

/**
 * Schema for a `type='raw'` score entry.
 *
 * Raw scores capture the live state during a specific assessment stage (CAT
 * progression on practice items vs test items, etc.), so `assessmentStage` is
 * required for this variant. Without a stage, raw scores from different stages
 * would collide on the natural key.
 */
export const RawScoreEntrySchema = ScoreEntryBaseSchema.extend({
  type: z.literal('raw'),
  assessmentStage: AssessmentStageSchema,
});

/**
 * Schema for a `type='computed'` score entry.
 *
 * Computed scores are derived/aggregate values (percentile, support level, final
 * composite). They may apply to a specific stage or be cross-stage, so
 * `assessmentStage` is optional.
 */
export const ComputedScoreEntrySchema = ScoreEntryBaseSchema.extend({
  type: z.literal('computed'),
  assessmentStage: AssessmentStageSchema.optional(),
});

/**
 * Discriminated-union schema for a single score entry in a run-level scoring update.
 *
 * Mirrors the natural-key shape of `app.run_scores` on the backend. A trial event may
 * carry zero or more of these in its `scores` array; each entry upserts the
 * corresponding row keyed on `(run_id, type, domain, name, assessment_stage)`.
 *
 * Discrimination on `type`:
 * - `raw` — `assessmentStage` is **required** (raw scores are stage-scoped)
 * - `computed` — `assessmentStage` is optional (computed scores may aggregate across stages)
 *
 * Encoding the rule in the contract gives TypeScript narrowing on the consumer side and
 * surfaces violations as 400 validation errors at the API edge rather than as runtime DB
 * errors. The same rule is enforced at the database via a CHECK constraint as
 * defense-in-depth.
 */
export const ScoreEntrySchema = z.discriminatedUnion('type', [RawScoreEntrySchema, ComputedScoreEntrySchema]);

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
export type RawScoreEntry = z.infer<typeof RawScoreEntrySchema>;
export type ComputedScoreEntry = z.infer<typeof ComputedScoreEntrySchema>;
export type ScoreType = z.infer<typeof ScoreTypeSchema>;
