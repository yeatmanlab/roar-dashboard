import { z } from 'zod';

// --- Grade-conditional field resolution ---

const GradeConditionEntrySchema = z.union([
  z.object({
    gradeLt: z.number().int(),
    value: z.string(),
  }),
  z.object({
    gradeGte: z.number().int(),
    value: z.string(),
  }),
]);

const GradeConditionalFieldSchema = z.object({
  gradeConditional: z.literal(true),
  conditions: z.array(GradeConditionEntrySchema).min(1),
});

/**
 * A field name value: a static string, null (not applicable), or a grade-conditional object.
 */
const FieldNameValueSchema = z.union([z.string(), z.null(), GradeConditionalFieldSchema]);

// --- Versioned arrays (shared pattern) ---

/**
 * Validate that a versioned array is in strictly descending minVersion order.
 * resolveVersionedEntry relies on this ordering — ascending entries would cause
 * the lowest-version entry to always match, silently ignoring newer entries.
 */
function descendingMinVersion<T extends { minVersion: number }>(entries: T[], ctx: z.RefinementCtx) {
  for (let i = 1; i < entries.length; i++) {
    const current = entries[i];
    const previous = entries[i - 1];
    if (current && previous && current.minVersion >= previous.minVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Entries must be in strictly descending minVersion order (found ${previous.minVersion} then ${current.minVersion})`,
      });
    }
  }
}

/**
 * A versioned entry for score field names.
 * Entries are ordered by descending minVersion; first match where scoringVersion >= minVersion wins.
 */
const VersionedFieldNameSchema = z.object({
  minVersion: z.number().int().min(0),
  fieldName: FieldNameValueSchema,
});

const VersionedFieldNameArraySchema = z.array(VersionedFieldNameSchema).min(1).superRefine(descendingMinVersion);

/**
 * A versioned entry for percentile cutoffs.
 */
const VersionedPercentileCutoffSchema = z.object({
  minVersion: z.number().int().min(0),
  cutoffs: z.object({
    achieved: z.number(),
    developing: z.number(),
  }),
});

/**
 * A versioned entry for raw score thresholds.
 */
const VersionedRawScoreThresholdSchema = z.object({
  minVersion: z.number().int().min(0),
  thresholds: z.object({
    above: z.number(),
    some: z.number(),
  }),
});

// --- Score field types ---

export const SCORE_FIELD_TYPES = [
  'percentile',
  'percentileDisplay',
  'standardScore',
  'standardScoreDisplay',
  'rawScore',
] as const;

const ScoreFieldTypeSchema = z.enum(SCORE_FIELD_TYPES);

/**
 * Score fields: each of the 5 field types maps to a versioned array of field names.
 */
const ScoreFieldsSchema = z.record(ScoreFieldTypeSchema, VersionedFieldNameArraySchema);

// --- Classification strategies (discriminated union) ---

const PercentileThenRawscoreClassificationSchema = z.object({
  type: z.literal('percentile-then-rawscore'),
  /** Exclusive upper bound: percentile cutoffs apply for grades strictly below this value.
   *  Defaults to 6 (grades K-5 use percentile, grade 6+ uses raw score). Set to null to use percentile for all grades. */
  percentileBelowGrade: z.number().int().nullable().default(6),
  percentileCutoffs: z.array(VersionedPercentileCutoffSchema).min(1).superRefine(descendingMinVersion),
  rawScoreThresholds: z.array(VersionedRawScoreThresholdSchema).min(1).superRefine(descendingMinVersion),
});

const AssessmentComputedClassificationSchema = z.object({
  type: z.literal('assessment-computed'),
  supportLevelField: z.string().optional(),
});

const NoneClassificationSchema = z.object({
  type: z.literal('none'),
});

const ClassificationSchema = z.discriminatedUnion('type', [
  PercentileThenRawscoreClassificationSchema,
  AssessmentComputedClassificationSchema,
  NoneClassificationSchema,
]);

// --- Subscores ---

/**
 * Per-subscore field-name conventions for tasks that emit sub-skill breakdowns
 * (PA: FSM/LSM/DEL; phonics: cvc/digraph/initial_blend/...).
 *
 * Each entry declares the `name` value used in `app_assessment_fdw.run_scores`
 * for that subscore and the kind of data we expect:
 *
 * - `correctName` — the score row whose `value` holds the correct count.
 * - `attemptedName` — the score row whose `value` holds the attempted count.
 * - `percentCorrectName` — optional. When provided, the service uses this
 *   pre-computed percent rather than re-deriving from correct/attempted.
 *
 * Names are matched case-sensitively against `run_scores.name`. The response
 * key (e.g., `FSM`, `cvc`) is the map key used in this config — that's what
 * the API surfaces in the per-task `subscores` object.
 */
const SubscoreFieldEntrySchema = z.object({
  correctName: z.string(),
  attemptedName: z.string(),
  percentCorrectName: z.string().optional(),
});

/**
 * Subscores config block. The top-level `key` is the response key (e.g., `FSM`,
 * `cvc`) and the value declares the run_scores names that populate it.
 */
const SubscoresSchema = z.record(z.string(), SubscoreFieldEntrySchema);

// --- Top-level scoring config ---

export const ScoringConfigSchema = z.object({
  taskSlugs: z.array(z.string()).min(1),
  scoreFields: ScoreFieldsSchema,
  classification: ClassificationSchema,
  /**
   * Optional subscores declaration. Tasks without sub-skill breakdowns omit
   * this block. The individual student report response only includes a
   * `subscores` field on per-task entries when this block is present.
   */
  subscores: SubscoresSchema.optional(),
});

// --- Inferred types ---

export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
export type ScoreFieldType = z.infer<typeof ScoreFieldTypeSchema>;
export type GradeConditionalField = z.infer<typeof GradeConditionalFieldSchema>;
export type FieldNameValue = z.infer<typeof FieldNameValueSchema>;
export type VersionedFieldName = z.infer<typeof VersionedFieldNameSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type PercentileThenRawscoreClassification = z.infer<typeof PercentileThenRawscoreClassificationSchema>;
