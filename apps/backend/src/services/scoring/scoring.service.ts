import { getGradeAsNumber } from '../../utils/get-grade-as-number.util';
import type { ScoringConfig, FieldNameValue, SCORE_FIELD_TYPES } from './scoring.config-schema';
import { getScoringConfig } from './scoring.config-registry';
import type { SupportLevel, ScoringInput, RawScoreThreshold, ScoreFieldResolution } from './scoring.types';

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
    if ('default' in condition && condition.default === true) {
      return condition.value;
    }
    if ('gradeLt' in condition && gradeLevel !== null && gradeLevel < condition.gradeLt) {
      return condition.value;
    }
    if ('gradeGte' in condition && gradeLevel !== null && gradeLevel >= condition.gradeGte) {
      return condition.value;
    }
  }

  // If gradeLevel is null and no default matched (shouldn't happen with valid config)
  return null;
}

// --- Public API ---

/**
 * Classify a student's score into a support level for a given task.
 *
 * Algorithm:
 * 1. Look up the task's scoring config
 * 2. If classification type is not 'percentile-then-rawscore', return null
 * 3. For grades < 6 with a percentile: use percentile cutoffs
 * 4. For grades >= 6, or no percentile: use raw score thresholds
 *
 * @param input - Scoring input with grade, percentile, rawScore, taskSlug, scoringVersion
 * @returns Support level classification, or null if classification is not possible
 */
export function getSupportLevel(input: ScoringInput): SupportLevel | null {
  const { grade, percentile, rawScore, taskSlug, scoringVersion } = input;

  // No score data at all — cannot classify
  if (rawScore === null && percentile === null) {
    return null;
  }

  const config = getScoringConfig(taskSlug);
  if (!config) {
    return null;
  }

  // Only percentile-then-rawscore classification produces support levels
  if (config.classification.type !== 'percentile-then-rawscore') {
    return null;
  }

  const classification = config.classification;
  const version = scoringVersion ?? 0;
  const gradeLevel = getGradeAsNumber(grade);

  // Try percentile-based classification for grades < 6
  if (percentile !== null && gradeLevel !== null && gradeLevel < 6) {
    const cutoffEntry = resolveVersionedEntry(classification.percentileCutoffs, version);
    if (cutoffEntry) {
      return classifyByThresholds(percentile, cutoffEntry.cutoffs.achieved, cutoffEntry.cutoffs.developing);
    }
  }

  // Fall back to raw score thresholds (grades >= 6 or no percentile)
  if (rawScore !== null) {
    const thresholdEntry = resolveVersionedEntry(classification.rawScoreThresholds, version);
    if (!thresholdEntry) {
      return null;
    }
    return classifyByThresholds(rawScore, thresholdEntry.thresholds.above, thresholdEntry.thresholds.some);
  }

  return null;
}

/**
 * Get raw score thresholds for a task and scoring version.
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
 * Resolve all possible score field names for a task across all versions.
 * Returns deduplicated arrays of field names for percentile and raw score fields.
 * Used for backward-compatible lookup when the scoring version is unknown.
 *
 * @param taskSlug - The task slug
 * @param gradeLevel - Numeric grade level, or null
 * @returns Resolved field names for percentile and raw score
 */
export function resolveScoreFieldNames(taskSlug: string, gradeLevel: number | null): ScoreFieldResolution {
  const config = getScoringConfig(taskSlug);
  if (!config) {
    return { percentileFieldNames: [], rawScoreFieldNames: [] };
  }

  const percentileFieldNames = collectAllFieldNames(config, 'percentile', gradeLevel);
  const rawScoreFieldNames = collectAllFieldNames(config, 'rawScore', gradeLevel);

  return { percentileFieldNames, rawScoreFieldNames };
}

// --- Internal helpers ---

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
