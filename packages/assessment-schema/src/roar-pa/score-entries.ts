import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import {
  PA_SUBTASK_KEYS,
  PA_SUBSCORE_DEFS,
  PA_SCORE_NAMES,
  PA_SCORE_DOMAINS,
  PA_RAW_SCORE_NAMES,
  type PaScoreName,
} from './index.js';

/**
 * Score entry for PA scores written to run_scores.
 * Mirrors the api-contract ScoreEntry discriminated union without importing it
 * directly, keeping assessment-schema decoupled from api-contract at build time.
 *
 * - type=RAW: live state captured from trial accumulation (counts, theta). assessmentStage required.
 * - type=COMPUTED: derived values (percentile, standardScore, percentCorrect). assessmentStage required.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface PaScoreEntry {
  type: ScoreType;
  domain: string;
  name: PaScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = PaScoreEntry extends ScoreEntryConstraint ? true : false;

/**
 * Composite-level score names for PA. These apply to the 'composite' and
 * 'composite_foundational' domains and cover the full range from raw counts
 * through normed output and scoring metadata.
 */
const COMPOSITE_NAMES = [
  PA_SCORE_NAMES.RAW_SCORE,
  PA_SCORE_NAMES.PERCENTILE,
  PA_SCORE_NAMES.PERCENTILE_SPR,
  PA_SCORE_NAMES.PERCENTILE_STRING_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE,
  PA_SCORE_NAMES.STANDARD_SCORE_SPR,
  PA_SCORE_NAMES.STANDARD_SCORE_STRING_SPR,
  PA_SCORE_NAMES.CEILING_FLAG,
  PA_SCORE_NAMES.CATEGORY_SCORE,
  PA_SCORE_NAMES.ROAR_SCORE_KIND,
  PA_SCORE_NAMES.SCORING_VERSION,
  PA_SCORE_NAMES.THETA_ESTIMATE,
  PA_SCORE_NAMES.THETA_SE,
  PA_SCORE_NAMES.THETA_ESTIMATE_RAW,
  PA_SCORE_NAMES.THETA_SE_RAW,
  PA_SCORE_NAMES.NUM_CORRECT,
  PA_SCORE_NAMES.NUM_ATTEMPTED,
  PA_SCORE_NAMES.NUM_INCORRECT,
] as const;

/**
 * Per-subtask score names extracted from the callback output for each FSM/LSM/DEL domain.
 * These are the generic names that appear under each subtask's uppercase domain.
 */
const SUBTASK_NAMES = [
  PA_SCORE_NAMES.NUM_CORRECT,
  PA_SCORE_NAMES.NUM_ATTEMPTED,
  PA_SCORE_NAMES.NUM_INCORRECT,
  PA_SCORE_NAMES.PERCENT_CORRECT,
  PA_SCORE_NAMES.ROAR_SCORE_KIND,
  PA_SCORE_NAMES.SCORING_VERSION,
  PA_SCORE_NAMES.THETA_ESTIMATE,
  PA_SCORE_NAMES.THETA_SE,
] as const;

const RECOGNIZED_GROUPS = new Set([
  ...PA_SUBTASK_KEYS.map((k) => k.toLowerCase()),
  PA_SCORE_DOMAINS.COMPOSITE,
  PA_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL,
]);

/**
 * Converts PA computed scores (nested object from RoarScores.computedScoreCallback)
 * to a flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Input structure (from scores.js callback):
 * ```
 * {
 *   fsm: { numCorrect, numAttempted, numIncorrect, percentCorrect, thetaEstimate?, thetaSE?, roarScoreKind, scoringVersion },
 *   lsm: { ... },
 *   del: { ... },
 *   composite: { roarScore, percentile, standardScore, numCorrect, numAttempted, numIncorrect, thetaEstimate?, ... },
 *   composite_foundational: { ... }  // adaptive scoring only
 * }
 * ```
 *
 * Output: Array of PaScoreEntry objects where:
 * - Subtask entries carry the uppercase domain (FSM, LSM, DEL) — never lowercase
 * - Composite entries carry 'composite' or 'composite_foundational'
 * - type is RAW for counts/theta, COMPUTED for normed/derived scores
 * - assessmentStage is always TEST (callback only uses test-phase data)
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback
 * @param options.strict - If true, throw on unrecognized group keys. Use in CI to catch schema drift.
 * @returns Array of PaScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized group key is encountered
 */
export function toPaScoreEntries(
  computed: Record<string, Record<string, unknown>>,
  { strict = false } = {},
): PaScoreEntry[] {
  const entries: PaScoreEntry[] = [];

  const add = (name: PaScoreName, value: unknown, domain: string) => {
    if (value == null) return;
    entries.push({
      type: PA_RAW_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
      domain,
      name,
      value: String(value),
      assessmentStage: AssessmentStage.TEST,
    });
  };

  // Per-subtask entries: uppercase domain (FSM/LSM/DEL), generic names.
  // PA_SUBTASK_KEYS order (FSM, LSM, DEL) is canonical; iterate in that order.
  // The callback returns lowercase keys ('fsm', 'lsm', 'del') so we lower-case
  // only for the lookup and use the uppercase key from PA_SUBSCORE_DEFS.domain.
  for (const subtaskKey of PA_SUBTASK_KEYS) {
    const subtaskScores = computed[subtaskKey.toLowerCase()];
    if (!subtaskScores) continue;

    const { domain } = PA_SUBSCORE_DEFS[subtaskKey];
    for (const name of SUBTASK_NAMES) {
      add(name, subtaskScores[name], domain);
    }
  }

  // Composite and composite_foundational entries.
  for (const groupKey of [PA_SCORE_DOMAINS.COMPOSITE, PA_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL]) {
    const groupScores = computed[groupKey];
    if (!groupScores) continue;

    for (const name of COMPOSITE_NAMES) {
      add(name, groupScores[name], groupKey);
    }
  }

  if (strict) {
    for (const groupKey of Object.keys(computed)) {
      if (!RECOGNIZED_GROUPS.has(groupKey)) {
        throw new Error(
          `Unrecognized score group "${groupKey}" in PA computed scores. ` +
            `Expected one of: ${Array.from(RECOGNIZED_GROUPS).sort().join(', ')}`,
        );
      }
    }
  }

  return entries;
}

// Legacy export alias — kept for any callers not yet updated to PaScoreEntry.
/** @deprecated Use PaScoreEntry */
export type ComputedScoreEntry = PaScoreEntry;
