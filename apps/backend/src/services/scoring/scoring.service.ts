import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import type { ScoringConfig, FieldNameValue, SCORE_FIELD_TYPES } from './scoring.config-schema';
import { getScoringConfig } from './scoring.config-registry';
import type { SupportLevel, ScoringInput, RawScoreThreshold, ScoreFieldResolution } from './scoring.types';

const ANGLE_BRACKET_PATTERN = /[<>]/g;
const VALID_SUPPORT_LEVELS: ReadonlySet<string> = new Set(['achievedSkill', 'developingSkill', 'needsExtraSupport']);

// --- Score value parsing ---

/**
 * Parse a raw score value from run_scores, handling angle bracket strings like ">99" or "<1".
 *
 * Percentile and standardScore fields in newer norming tables (swr v7+, sre v4+, and
 * their Spanish variants) may be stored as strings with angle brackets. This utility
 * strips those characters and returns a numeric value suitable for classification.
 *
 * @param value - Raw score value (may be a string with angle brackets, a number, null, or undefined)
 * @returns Parsed numeric value, or null if the input is absent or unparseable
 */
export function parseScoreValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  const stripped = value.replace(ANGLE_BRACKET_PATTERN, '');
  const parsed = parseFloat(stripped);
  return isNaN(parsed) ? null : parsed;
}

// --- Versioned array resolution ---

/**
 * Resolve from an ordered versioned array. Entries must be ordered by descending minVersion.
 * Returns the value from the first entry where scoringVersion >= minVersion, or undefined.
 */
function resolveVersionedEntry<T extends { minVersion: number }>(entries: T[], scoringVersion: number): T | undefined {
  return entries.find((entry) => scoringVersion >= entry.minVersion);
}

// --- Grade-conditional field resolution ---

/**
 * Resolve a field name value, handling strings, nulls, and grade-conditional objects.
 *
 * @param value - The field name value from config (string, null, or grade-conditional)
 * @param gradeLevel - Numeric grade level, or null
 * @returns The resolved field name string, or null
 */
function resolveFieldValue(value: FieldNameValue, gradeLevel: number | null): string | null {
  if (value === null || typeof value === 'string') {
    return value;
  }

  // Grade-conditional: evaluate conditions top-to-bottom
  for (const condition of value.conditions) {
    if ('gradeLt' in condition && gradeLevel !== null && gradeLevel < condition.gradeLt) {
      return condition.value;
    }
    if ('gradeGte' in condition && (gradeLevel === null || gradeLevel >= condition.gradeGte)) {
      return condition.value;
    }
  }

  // No condition matched (shouldn't happen with valid config)
  return null;
}

// --- Public API ---

/**
 * Classify a student's score into a support level for a given task.
 *
 * Algorithm:
 * 1. Look up the task's scoring config
 * 2. For assessment-computed tasks: validate and return the pre-computed support level
 * 3. For percentile-then-rawscore tasks:
 *    a. For grades below percentileBelowGrade (default 6, exclusive) with a percentile: use percentile cutoffs
 *    b. Otherwise: use raw score thresholds
 * 4. For none type: return null (no classification)
 *
 * @param input - Scoring input with grade, percentile, rawScore, taskSlug, scoringVersion
 * @returns Support level classification, or null if classification is not possible
 */
export function getSupportLevel(input: ScoringInput): SupportLevel | null {
  const { grade, percentile, rawScore, taskSlug, scoringVersion } = input;

  const config = getScoringConfig(taskSlug);
  if (!config) {
    return null;
  }

  // Assessment-computed: validate the pre-computed support level from the assessment
  if (config.classification.type === 'assessment-computed') {
    const level = input.assessmentSupportLevel;
    if (typeof level === 'string' && VALID_SUPPORT_LEVELS.has(level)) {
      return level as SupportLevel;
    }
    return null;
  }

  // Only percentile-then-rawscore classification produces computed support levels.
  // Tasks with type "none" (e.g., letter, phonics) display raw scores without support levels.
  if (config.classification.type === 'none') {
    return null;
  }

  // No score data at all — cannot classify
  if (rawScore === null && percentile === null) {
    return null;
  }

  const classification = config.classification;
  const version = scoringVersion ?? 0;
  const gradeLevel = getGradeAsNumber(grade);

  // Try percentile-based classification (config-driven grade threshold).
  // percentileBelowGrade defaults to 6 (exclusive); null means use percentile for all grades.
  const maxGrade = classification.percentileBelowGrade;
  const usePercentile = percentile !== null && (maxGrade === null || (gradeLevel !== null && gradeLevel < maxGrade));

  if (usePercentile) {
    const cutoffEntry = resolveVersionedEntry(classification.percentileCutoffs, version);
    if (cutoffEntry) {
      return classifyByThresholds(percentile!, cutoffEntry.cutoffs.achieved, cutoffEntry.cutoffs.developing);
    }
  }

  // Fall back to raw score thresholds (grades >= maxGrade or no percentile)
  if (rawScore !== null) {
    const thresholdEntry = resolveVersionedEntry(classification.rawScoreThresholds, version);
    if (thresholdEntry) {
      return classifyByThresholds(rawScore, thresholdEntry.thresholds.above, thresholdEntry.thresholds.some);
    }
  }

  return null;
}

/**
 * Get raw score thresholds for a task and scoring version.
 *
 * Use this to retrieve the threshold values themselves (e.g., for display in a score report).
 * To classify a score into a support level, use {@link getSupportLevel} instead — it applies
 * the full classification algorithm (percentile cutoffs first, then raw score fallback).
 *
 * @param taskSlug - The task slug (e.g., 'swr', 'sre')
 * @param scoringVersion - The scoring version, or null for legacy
 * @returns Raw score thresholds { above, some }, or null if unavailable
 */
export function getRawScoreThreshold(taskSlug: string, scoringVersion: number | null): RawScoreThreshold | null {
  const config = getScoringConfig(taskSlug);
  if (!config || config.classification.type !== 'percentile-then-rawscore') {
    return null;
  }

  const version = scoringVersion ?? 0;
  const entry = resolveVersionedEntry(config.classification.rawScoreThresholds, version);
  if (!entry) {
    return null;
  }

  return { above: entry.thresholds.above, some: entry.thresholds.some };
}

/**
 * Resolve a single score field name for a specific task, field type, grade, and scoring version.
 *
 * @param taskSlug - The task slug
 * @param gradeLevel - Numeric grade level, or null
 * @param fieldType - One of the 5 score field types
 * @param scoringVersion - The scoring version
 * @returns The resolved field name, or null if not applicable
 */
export function resolveScoreFieldName(
  taskSlug: string,
  gradeLevel: number | null,
  fieldType: (typeof SCORE_FIELD_TYPES)[number],
  scoringVersion: number | null,
): string | null {
  const config = getScoringConfig(taskSlug);
  if (!config) {
    return null;
  }

  const fieldEntries = config.scoreFields[fieldType];
  if (!fieldEntries) {
    return null;
  }

  const version = scoringVersion ?? 0;
  const entry = resolveVersionedEntry(fieldEntries, version);
  if (!entry) {
    return null;
  }

  return resolveFieldValue(entry.fieldName, gradeLevel);
}

/**
 * Resolve score field names for a task, optionally filtered by scoring version.
 *
 * When scoringVersion is provided (including null for legacy v0), returns only
 * the field names applicable to that specific version — prevents callers from
 * looking up field names that don't exist in the norming tables for that version.
 *
 * When omitted, returns all possible field names across all versions (backward compat).
 *
 * @param taskSlug - The task slug
 * @param gradeLevel - Numeric grade level, or null
 * @param scoringVersion - When provided, resolve for this version only. Omit for all versions.
 * @returns Resolved field names for percentile and raw score
 */
export function resolveScoreFieldNames(
  taskSlug: string,
  gradeLevel: number | null,
  scoringVersion?: number | null,
): ScoreFieldResolution {
  const emptyResolution: ScoreFieldResolution = {
    percentileFieldNames: [],
    percentileDisplayFieldNames: [],
    standardScoreFieldNames: [],
    standardScoreDisplayFieldNames: [],
    rawScoreFieldNames: [],
  };

  const config = getScoringConfig(taskSlug);
  if (!config) {
    return emptyResolution;
  }

  // When a scoring version is provided, resolve for that specific version only.
  if (scoringVersion !== undefined) {
    const version = scoringVersion ?? 0;
    return {
      percentileFieldNames: collectVersionSpecificFieldNames(taskSlug, 'percentile', gradeLevel, version),
      percentileDisplayFieldNames: collectVersionSpecificFieldNames(taskSlug, 'percentileDisplay', gradeLevel, version),
      standardScoreFieldNames: collectVersionSpecificFieldNames(taskSlug, 'standardScore', gradeLevel, version),
      standardScoreDisplayFieldNames: collectVersionSpecificFieldNames(
        taskSlug,
        'standardScoreDisplay',
        gradeLevel,
        version,
      ),
      rawScoreFieldNames: collectVersionSpecificFieldNames(taskSlug, 'rawScore', gradeLevel, version),
    };
  }

  return {
    percentileFieldNames: collectAllFieldNames(config, 'percentile', gradeLevel),
    percentileDisplayFieldNames: collectAllFieldNames(config, 'percentileDisplay', gradeLevel),
    standardScoreFieldNames: collectAllFieldNames(config, 'standardScore', gradeLevel),
    standardScoreDisplayFieldNames: collectAllFieldNames(config, 'standardScoreDisplay', gradeLevel),
    rawScoreFieldNames: collectAllFieldNames(config, 'rawScore', gradeLevel),
  };
}

/**
 * Get the field name that contains a pre-computed support level for assessment-computed tasks.
 * Returns null for tasks that don't use assessment-computed classification.
 *
 * @param taskSlug - The task slug (e.g., 'roam-alpaca')
 * @returns The run_scores field name containing the support level, or null
 */
export function getSupportLevelFieldName(taskSlug: string): string | null {
  const config = getScoringConfig(taskSlug);
  if (!config || config.classification.type !== 'assessment-computed') {
    return null;
  }
  return config.classification.supportLevelField ?? null;
}

/**
 * Get the subscore declaration block for a task, or `null` for tasks without
 * sub-skill breakdowns.
 *
 * The returned record is keyed by the response-side subscore key (e.g., `FSM`,
 * `cvc`) and the value declares the `run_scores.name` values that hold the
 * `correct`, `attempted`, and (optionally) `percentCorrect` counts.
 *
 * @param taskSlug - The task slug
 * @returns The subscores config block, or `null` if absent
 */
export function getSubscoresConfig(taskSlug: string): ScoringConfig['subscores'] | null {
  const config = getScoringConfig(taskSlug);
  return config?.subscores ?? null;
}

// --- PA-specific constants ---

/**
 * PA proficiency threshold (~78.9%) — a subscore is flagged as "needs work"
 * when its `percentCorrect` is below this value.
 *
 * Ported from the legacy frontend constant in `apps/dashboard/src/helpers/reports.js`
 * (`(15 / 19) * 100`). Lives in the backend scoring service so the
 * individual-student-report endpoint can compute `skillsToWorkOn` server-side.
 */
export const PA_SKILL_THRESHOLD = (15 / 19) * 100;

/**
 * Legacy PA proficiency threshold for fixed-item (non-adaptive) PA assessments
 * that only emit a `roarScore` correct count without a `percentCorrect`.
 * A subscore is flagged as "needs work" when `roarScore < 15`.
 *
 * Ported from `PA_SKILL_LEGACY_THRESHOLD` in the legacy frontend helper. The
 * backend service falls back to this only when `percentCorrect` is unavailable.
 */
export const PA_SKILL_LEGACY_THRESHOLD = 15;

/**
 * Canonical ordering of PA subscore keys. The response's `skillsToWorkOn` array
 * preserves this order; the same keys appear as the response-side keys in the
 * `subscores` map declared by `pa.json`'s `subscores` block.
 */
export const PA_SUBTASK_KEYS = ['FSM', 'LSM', 'DEL'] as const;

export type PaSubtaskKey = (typeof PA_SUBTASK_KEYS)[number];

// --- Internal helpers ---

/**
 * Resolve the single field name for a specific version, returning it as a singleton array.
 */
function collectVersionSpecificFieldNames(
  taskSlug: string,
  fieldType: (typeof SCORE_FIELD_TYPES)[number],
  gradeLevel: number | null,
  scoringVersion: number,
): string[] {
  const resolved = resolveScoreFieldName(taskSlug, gradeLevel, fieldType, scoringVersion);
  return resolved !== null ? [resolved] : [];
}

/**
 * Collect all unique, non-null field names across all version entries for a field type.
 */
function collectAllFieldNames(
  config: ScoringConfig,
  fieldType: (typeof SCORE_FIELD_TYPES)[number],
  gradeLevel: number | null,
): string[] {
  const fieldEntries = config.scoreFields[fieldType];
  if (!fieldEntries) {
    return [];
  }

  const names = new Set<string>();
  for (const entry of fieldEntries) {
    const resolved = resolveFieldValue(entry.fieldName, gradeLevel);
    if (resolved !== null) {
      names.add(resolved);
    }
  }
  return [...names];
}

/**
 * Classify a numeric score against achieved/developing thresholds.
 * - score >= achieved → achievedSkill
 * - score > developing AND score < achieved → developingSkill
 * - otherwise → needsExtraSupport
 */
function classifyByThresholds(score: number, achievedThreshold: number, developingThreshold: number): SupportLevel {
  if (score >= achievedThreshold) {
    return 'achievedSkill';
  }
  if (score > developingThreshold) {
    return 'developingSkill';
  }
  return 'needsExtraSupport';
}
