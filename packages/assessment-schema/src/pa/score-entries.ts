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
 * Mirrors the shape of the api-contract ScoreEntry type but kept local
 * to avoid coupling assessment-schema to api-contract at build time.
 * The adapter return type is verified at runtime in CI with strict: true.
 */
export interface ComputedScoreEntry {
  type: 'computed';
  domain: string;
  name: PaScoreName;
  value: string;
  assessmentStage?: 'practice' | 'test';
}

/**
 * Summary score names that are emitted at the composite level.
 * These are the final aggregate scores (percentile, standard score, etc.)
 * that apply across all subtasks.
 */
const SUMMARY_NAMES = [
  PA_SCORE_NAMES.RAW_SCORE,
  PA_SCORE_NAMES.PERCENTILE,
  PA_SCORE_NAMES.PERCENTILE_SPR,
  PA_SCORE_NAMES.PERCENTILE_STRING_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE,
  PA_SCORE_NAMES.STANDARD_SCORE_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR,
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
 * - domain: 'pa' (PA_TASK_ID)
 * - name: one of PA_SCORE_NAMES values
 * - value: stringified score value
 * - assessmentStage: omitted (computed scores aggregate across stages)
 *
 * @param computed - Nested computed scores object from RoarScores.computedScoreCallback
 * @param options - Configuration options
 * @param options.strict - If true, throw on unregistered score groups; if false, skip them
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unregistered score group is encountered
 *
 * @example
 * ```ts
 * const computed = {
 *   fsm: { numCorrect: 10, numAttempted: 15, percentCorrect: 67, ... },
 *   composite: { roarScore: 25, percentile: 60, standardScore: 105, ... }
 * };
 * const entries = toPaScoreEntries(computed);
 * // Returns:
 * // [
 * //   { type: 'computed', domain: 'pa', name: 'fsmCorrect', value: '10' },
 * //   { type: 'computed', domain: 'pa', name: 'fsmAttempted', value: '15' },
 * //   { type: 'computed', domain: 'pa', name: 'fsmPercentCorrect', value: '67' },
 * //   { type: 'computed', domain: 'pa', name: 'roarScore', value: '25' },
 * //   { type: 'computed', domain: 'pa', name: 'percentile', value: '60' },
 * //   { type: 'computed', domain: 'pa', name: 'standardScore', value: '105' },
 * //   ...
 * // ]
 * ```
 */
export function toPaScoreEntries(
  computed: Record<string, any>,
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

  // Validate that all emitted names are registered in the schema (strict mode)
  if (strict) {
    const registeredNames = new Set(Object.values(PA_SCORE_NAMES));
    const emittedNames = new Set(entries.map((e: ComputedScoreEntry) => e.name));
    for (const name of emittedNames) {
      if (!registeredNames.has(name)) {
        throw new Error(
          `Unregistered PA score name "${name}" — add it to PA_SCORE_NAMES in assessment-schema before emitting. ` +
            `Registered names: ${Array.from(registeredNames).sort().join(', ')}`,
        );
      }
    }
  }

  return entries;
}
