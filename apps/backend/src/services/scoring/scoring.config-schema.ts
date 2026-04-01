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
  z.object({
    default: z.literal(true),
    value: z.string(),
  }),
]);

const GradeConditionalFieldSchema = z
  .object({
    gradeConditional: z.literal(true),
    conditions: z.array(GradeConditionEntrySchema).min(1),
  })
  .refine((val) => val.conditions.filter((c) => 'default' in c && c.default === true).length === 1, {
    message: 'Exactly one condition must have "default": true',
  });

/**
 * A field name value: a static string, null (not applicable), or a grade-conditional object.
 */
const FieldNameValueSchema = z.union([z.string(), z.null(), GradeConditionalFieldSchema]);

// --- Versioned arrays (shared pattern) ---

/**
 * A versioned entry for score field names.
 * Entries are ordered by descending minVersion; first match where scoringVersion >= minVersion wins.
 */
const VersionedFieldNameSchema = z.object({
  minVersion: z.number().int().min(0),
  fieldName: FieldNameValueSchema,
});

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
const ScoreFieldsSchema = z.record(ScoreFieldTypeSchema, z.array(VersionedFieldNameSchema).min(1));

// --- Classification strategies (discriminated union) ---

const PercentileThenRawscoreClassificationSchema = z.object({
  type: z.literal('percentile-then-rawscore'),
  percentileCutoffs: z.array(VersionedPercentileCutoffSchema).min(1),
  rawScoreThresholds: z.array(VersionedRawScoreThresholdSchema).min(1),
});

const RawscoreOnlyClassificationSchema = z.object({
  type: z.literal('rawscore-only'),
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
  RawscoreOnlyClassificationSchema,
  AssessmentComputedClassificationSchema,
  NoneClassificationSchema,
]);

// --- Top-level scoring config ---

export const ScoringConfigSchema = z.object({
  taskSlugs: z.array(z.string()).min(1),
  scoreFields: ScoreFieldsSchema,
  stripAngleBrackets: z.array(ScoreFieldTypeSchema).optional(),
  classification: ClassificationSchema,
});

// --- Inferred types ---

export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
export type ScoreFieldType = z.infer<typeof ScoreFieldTypeSchema>;
export type GradeConditionalField = z.infer<typeof GradeConditionalFieldSchema>;
export type FieldNameValue = z.infer<typeof FieldNameValueSchema>;
export type VersionedFieldName = z.infer<typeof VersionedFieldNameSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type PercentileThenRawscoreClassification = z.infer<typeof PercentileThenRawscoreClassificationSchema>;
