import { PA_SUBTASK_KEYS, PA_SUBSCORE_DEFS, PA_SCORE_NAMES, PA_TASK_ID, type PaScoreName } from './index.js';

/**
 * Score domain constants for PA assessment.
 * These map to the backend's SCORE_DOMAIN values for proper recompute lookups.
 */
const SCORE_DOMAIN = {
  COMPOSITE: 'composite',
  COMPOSITE_FOUNDATIONAL: 'composite_foundational',
} as const;

/**
 * Score entry for computed scores (aggregates across stages).
 * Mirrors the shape of the api-contract ComputedScoreEntry type but kept local
 * to avoid coupling assessment-schema to api-contract at build time.
 * The adapter return type is verified at runtime in CI with strict: true.
 *
 * Compile-time type check: If api-contract adds a required field to ComputedScoreEntry,
 * the _typeCheck assignment below will fail with a TypeScript error, alerting us to update
 * this interface. This ensures contract changes surface immediately at compile time.
 * @see packages/api-contract/src/v1/runs/schema.ts
 */
export interface ComputedScoreEntry {
  type: 'computed';
  domain: string;
  name: PaScoreName;
  value: string;
}

// Compile-time assertion: ComputedScoreEntry must be assignable to api-contract's ComputedScoreEntry.
// The api-contract defines: { type: 'computed'; domain: string; name: string; value: string; categoryScore?: boolean; assessmentStage?: string }
// If api-contract adds a NEW REQUIRED field, this check will fail and alert us to update this interface.
// Optional fields (categoryScore, assessmentStage) don't cause failures since our interface can omit them.
declare const _typeCheck: ComputedScoreEntry extends {
  type: 'computed';
  domain: string;
  name: string;
  value: string;
  categoryScore?: boolean;
  assessmentStage?: string;
}
  ? true
  : false;

/**
 * Summary score names that are emitted at the composite level.
 * These are the final aggregate scores (percentile, standard score, theta estimates, etc.)
 * that apply across all subtasks.
 * Theta fields are only populated for adaptive scoring (v4+).
 */
const SUMMARY_NAMES = [
  PA_SCORE_NAMES.RAW_SCORE,
  PA_SCORE_NAMES.PERCENTILE,
  PA_SCORE_NAMES.PERCENTILE_SPR,
  PA_SCORE_NAMES.PERCENTILE_STRING_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE,
  PA_SCORE_NAMES.STANDARD_SCORE_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR,
  PA_SCORE_NAMES.THETA_ESTIMATE,
  PA_SCORE_NAMES.THETA_SE,
  PA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  PA_SCORE_NAMES.THETA_SE_RAW,
] as const;

/**
 * Converts PA computed scores (nested object from RoarScores.computedScoreCallback)
 * to a flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Input structure (from scores.js callback):
 * ```
 * {
 *   fsm: { numCorrect, numAttempted, percentCorrect, roarScore?, ... },
 *   lsm: { numCorrect, numAttempted, percentCorrect, roarScore?, ... },
 *   del: { numCorrect, numAttempted, percentCorrect, roarScore?, ... },
 *   composite: { roarScore, percentile, standardScore, ... },
 *   composite_foundational: { roarScore, percentile, standardScore, ... }  // if adaptive
 * }
 * ```
 *
 * Output: Array of ScoreEntry objects with:
 * - type: 'computed' (PA computed scores are final aggregates)
 * - domain: PA_TASK_ID for subtask scores; 'composite' or 'composite_foundational' for composite scores
 * - name: one of PA_SCORE_NAMES values
 * - value: stringified score value
 *
 * @param computed - Nested computed scores object from RoarScores.computedScoreCallback
 * @param options - Configuration options
 * @param options.strict - If true, throw on unrecognized input group keys; if false, silently skip them
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized input group key is encountered
 *
 * @example
 * ```ts
 * const computed = {
 *   fsm: { numCorrect: 10, percentCorrect: 67, thetaEstimate: 0.5, thetaSE: 0.2 },
 *   lsm: { numCorrect: 12, percentCorrect: 80, thetaEstimate: 0.8, thetaSE: 0.18 },
 *   composite: { roarScore: 25, percentile: 60, standardScore: 105, thetaEstimate: 0.65, thetaSE: 0.15 },
 *   composite_foundational: { roarScore: 22, percentile: 55, standardScore: 100, thetaEstimate: 0.6, thetaSE: 0.16 }
 * };
 * const entries = toPaScoreEntries(computed);
 * // Returns:
 * // [
 * //   { type: 'computed', domain: 'pa', name: 'fsmCorrect', value: '10' },
 * //   { type: 'computed', domain: 'pa', name: 'fsmPercentCorrect', value: '67' },
 * //   { type: 'computed', domain: 'pa', name: 'thetaEstimate', value: '0.5' },
 * //   { type: 'computed', domain: 'pa', name: 'thetaSE', value: '0.2' },
 * //   { type: 'computed', domain: 'pa', name: 'lsmCorrect', value: '12' },
 * //   { type: 'computed', domain: 'pa', name: 'lsmPercentCorrect', value: '80' },
 * //   { type: 'computed', domain: 'pa', name: 'roarScore', value: '12' },
 * //   { type: 'computed', domain: 'composite', name: 'roarScore', value: '25' },
 * //   { type: 'computed', domain: 'composite', name: 'percentile', value: '60' },
 * //   { type: 'computed', domain: 'composite', name: 'standardScore', value: '105' },
 * //   { type: 'computed', domain: 'composite_foundational', name: 'roarScore', value: '22' },
 * //   { type: 'computed', domain: 'composite_foundational', name: 'percentile', value: '55' },
 * //   ...
 * // ]
 * ```
 */
export function toPaScoreEntries(
  computed: Record<string, Record<string, unknown>>,
  { strict = false } = {},
): ComputedScoreEntry[] {
  const entries: ComputedScoreEntry[] = [];

  const add = (name: PaScoreName, value: unknown) => {
    if (value == null) return;
    entries.push({
      type: 'computed',
      domain: PA_TASK_ID,
      name,
      value: String(value),
    });
  };

  // Iterate over subtasks (FSM, LSM, DEL) in canonical order
  for (const subtaskKey of PA_SUBTASK_KEYS) {
    const subtaskKeyLower = subtaskKey.toLowerCase();
    const subtaskScores = computed[subtaskKeyLower];

    if (subtaskScores) {
      const def = PA_SUBSCORE_DEFS[subtaskKey];
      add(def.correctName, subtaskScores.numCorrect);
      // Note: #Attempted names are not emitted by scores.js callback
      // They are kept in PA_SUBSCORE_DEFS for UI display only
      add(def.percentCorrectName, subtaskScores.percentCorrect);
      // Emit theta fields for adaptive scoring (v4+)
      add(PA_SCORE_NAMES.THETA_ESTIMATE, subtaskScores.thetaEstimate);
      add(PA_SCORE_NAMES.THETA_SE, subtaskScores.thetaSE);
    }
  }

  // Process composite and composite_foundational groups
  // Use different domains to avoid natural-key collision on (type, domain, name, assessmentStage)
  for (const groupKey of ['composite', 'composite_foundational']) {
    const groupScores = computed[groupKey];
    if (groupScores) {
      // Use different domain for composite_foundational to distinguish from composite
      // Domains must match backend SCORE_DOMAIN constants for recompute lookups
      const domain = groupKey === 'composite_foundational' ? SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL : SCORE_DOMAIN.COMPOSITE;
      const addWithDomain = (name: PaScoreName, value: unknown) => {
        if (value == null) return;
        entries.push({
          type: 'computed',
          domain,
          name,
          value: String(value),
        });
      };

      for (const summaryName of SUMMARY_NAMES) {
        addWithDomain(summaryName, groupScores[summaryName]);
      }
    }
  }

  // Validate that all input group keys are recognized (strict mode)
  // This catches typos or unexpected groups in the computed scores object
  if (strict) {
    const recognizedGroups = new Set([
      ...PA_SUBTASK_KEYS.map((k) => k.toLowerCase()),
      'composite',
      'composite_foundational',
    ]);
    for (const groupKey of Object.keys(computed)) {
      if (!recognizedGroups.has(groupKey)) {
        throw new Error(
          `Unrecognized score group "${groupKey}" in computed scores. ` +
            `Expected one of: ${Array.from(recognizedGroups).sort().join(', ')}`,
        );
      }
    }
  }

  return entries;
}
