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
 * The `subscores` block declares an ORDERED list of columns for a task's
 * sub-skill breakdown. Two endpoints consume it:
 *
 * - The individual-student-report (`extractSubscoresFromScoreMap`) surfaces the
 *   per-subtask `itemLevel` columns flagged as `subskill` (the default), keyed
 *   by `key` (e.g. `FSM`/`LSM`/`DEL` for PA, `cvc`/`digraph`/… for phonics).
 * - The task-subscores endpoint renders the full ordered column list, using
 *   `key` + `label` as table-header metadata and the per-`kind` value source
 *   below to populate cells.
 *
 * This block replaces the standalone `subscore-table.registry` that previously
 * hard-coded these columns in the backend. Field-name strings come from the
 * shared `@roar-platform/assessment-schema` package for verified assessments
 * (PA, phonics). Best-guess names for not-yet-migrated assessments (letter,
 * fluency, roam-alpaca) are flagged `provisional: true` and will move into
 * assessment-schema as each assessment lands in the monorepo — the end state is
 * zero hard-coded score-name strings in the backend.
 *
 * Column kinds:
 * - `itemLevel`         — combines `correctName` + `attemptedName` into a
 *                         `"correct/attempted"` string. `percentCorrectName`,
 *                         when present, drives numeric sort/filter. `subskill`
 *                         (default true) marks columns forming the per-subtask
 *                         breakdown surfaced by the individual-student-report;
 *                         aggregate columns like a task "Total" set it false.
 * - `number`            — single `run_scores.name` parsed as a number,
 *                         optionally `round`ed for display.
 * - `stringPassthrough` — single `run_scores.name` whose string value is
 *                         forwarded as-is (e.g. comma-separated "to work on"
 *                         lists).
 * - `paSkillsToWorkOn`  — computed PA-only column; value derived from the PA
 *                         subtask breakdown by the scoring service.
 *
 * Names are matched case-sensitively against `app_assessment_fdw.run_scores.name`.
 */
const subscoreColumnBaseFields = {
  /** Stable response key; appears in the per-task `subscores` object and as a `subscoreColumns[].key`. */
  key: z.string(),
  /** Human-readable column header label. */
  label: z.string(),
  /** Flags a best-guess column for an assessment not yet migrated into assessment-schema. */
  provisional: z.boolean().optional(),
};

const ItemLevelSubscoreColumnSchema = z.object({
  kind: z.literal('itemLevel'),
  ...subscoreColumnBaseFields,
  correctName: z.string(),
  attemptedName: z.string(),
  percentCorrectName: z.string().optional(),
  /**
   * Uppercase domain key matching `run_scores.domain` for this subscore (e.g.
   * FSM, LSM, DEL, composite). Only set for tasks that emit GENERIC score names
   * under per-subtask domains (PA: numCorrect/numAttempted/percentCorrect under
   * FSM/LSM/DEL). When set, lookups go through the domain-indexed score map;
   * tasks with distinct per-skill names (phonics, etc.) omit it.
   */
  domain: z.string().optional(),
  /** Whether this column is part of the per-subtask sub-skill breakdown (default true). */
  subskill: z.boolean().optional().default(true),
});

const NumberSubscoreColumnSchema = z.object({
  kind: z.literal('number'),
  ...subscoreColumnBaseFields,
  name: z.string(),
  round: z.boolean().optional(),
});

const StringPassthroughSubscoreColumnSchema = z.object({
  kind: z.literal('stringPassthrough'),
  ...subscoreColumnBaseFields,
  name: z.string(),
});

const PaSkillsToWorkOnSubscoreColumnSchema = z.object({
  kind: z.literal('paSkillsToWorkOn'),
  ...subscoreColumnBaseFields,
});

const SubscoreColumnSchema = z.discriminatedUnion('kind', [
  ItemLevelSubscoreColumnSchema,
  NumberSubscoreColumnSchema,
  StringPassthroughSubscoreColumnSchema,
  PaSkillsToWorkOnSubscoreColumnSchema,
]);

/**
 * Subscores config block: an ORDERED array of columns. Order is significant —
 * it is the order the task-subscores table renders columns in.
 */
const SubscoresSchema = z.array(SubscoreColumnSchema).min(1);

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

// Subscore column types (consumed by the scoring service helpers + report service)
export type SubscoreColumn = z.infer<typeof SubscoreColumnSchema>;
export type ItemLevelSubscoreColumn = z.infer<typeof ItemLevelSubscoreColumnSchema>;
export type NumberSubscoreColumn = z.infer<typeof NumberSubscoreColumnSchema>;
export type StringPassthroughSubscoreColumn = z.infer<typeof StringPassthroughSubscoreColumnSchema>;
export type PaSkillsToWorkOnSubscoreColumn = z.infer<typeof PaSkillsToWorkOnSubscoreColumnSchema>;
