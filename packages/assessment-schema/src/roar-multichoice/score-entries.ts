import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { MULTICHOICE_SCORE_DOMAINS } from './domains.js';
import {
  MULTICHOICE_COMPOSITE_SCORE_NAMES,
  MULTICHOICE_COMPREHENSION_SCORE_NAMES,
  MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES,
} from './score-names.js';
import type {
  MultichoiceCompositeName,
  MultichoiceComprehensionName,
  MultichoiceNonAdaptiveName,
  MultichoiceScoreName,
} from './score-names.js';

/**
 * Score entry shape for multichoice (morphology and CVA) scores written to run_scores.
 * Mirrors api-contract's ScoreEntry discriminated union without importing it directly,
 * keeping assessment-schema decoupled from api-contract at build time.
 */
export interface MultichoiceScoreEntry {
  type: ScoreType;
  domain: string;
  name: MultichoiceScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = MultichoiceScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_DOMAINS = new Set<string>([
  MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
  MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION,
]);

// Fields written as type=RAW in the adaptive composite domain:
//   - thetaEstimateRaw / thetaSERaw: native-scale IRT engine output
//   - totalCorrect / totalNumAttempted: raw trial counts
// All other composite fields (thetaEstimate, thetaSE, derived percentages,
// metadata, normed scores) are type=COMPUTED.
const COMPOSITE_RAW_NAMES = new Set<MultichoiceCompositeName>([
  MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
  MULTICHOICE_COMPOSITE_SCORE_NAMES.THETA_SE_RAW,
  MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
  MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_NUM_ATTEMPTED,
]);

// Fields written as type=RAW in the composite_comprehension domain:
//   - thetaEstimateRaw / thetaSERaw: native-scale IRT engine output
const COMPREHENSION_RAW_NAMES = new Set<MultichoiceComprehensionName>([
  MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_ESTIMATE_RAW,
  MULTICHOICE_COMPREHENSION_SCORE_NAMES.THETA_SE_RAW,
]);

/**
 * Converts multichoice computed scores (from RoarScores.computedScoreCallback) to a
 * flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Handles all four scoring modes produced by the assessment:
 *
 * 1. **Non-adaptive** (`composite` has `subScore` but not `totalCorrect`):
 *    Emits `subScore` and `subPercentCorrect` as type=COMPUTED under the composite domain.
 *
 * 2. **Adaptive, IRT not converged** (`composite` has `totalCorrect` but theta is null):
 *    Emits raw counts (`totalCorrect`, `totalNumAttempted`) and the derived
 *    `totalPercentCorrect`, plus metadata (`roarScoreKind`, `scoringVersion`).
 *    Null theta fields are skipped.
 *
 * 3. **Adaptive, IRT converged** (`thetaEstimate` is non-null):
 *    Also emits the theta estimate/SE pairs (raw native-scale + computed shared-scale).
 *
 * 4. **Adaptive, IRT converged + normed lookup resolved** (`roarScore` is non-null):
 *    Also emits `roarScore`, `standardScore`, and `percentile` as type=COMPUTED.
 *
 * The `composite_comprehension` domain follows a subset of mode 2/3 above (IRT only,
 * no counts, no normed scores). It is present only when `isAdaptive: true` in the
 * assessment run.
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized domain keys. Use in
 *   CI/test to catch new domains that toMultichoiceScoreEntries doesn't yet handle.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain key is encountered
 */
export function toMultichoiceScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): MultichoiceScoreEntry[] {
  if (!computed) return [];

  if (strict) {
    const unrecognized = Object.keys(computed).filter((k) => !RECOGNIZED_DOMAINS.has(k));
    if (unrecognized.length > 0) {
      throw new Error(
        `Unrecognized score domains in multichoice computed scores: ${unrecognized.join(', ')}. ` +
          `Update toMultichoiceScoreEntries to handle the new domain.`,
      );
    }
  }

  const entries: MultichoiceScoreEntry[] = [];

  const composite = computed[MULTICHOICE_SCORE_DOMAINS.COMPOSITE];
  if (composite) {
    // Detect adaptive vs non-adaptive: the adaptive branch of scores.js overwrites
    // composite with totalCorrect/totalNumAttempted; the non-adaptive _mapValues
    // pass produces subScore/subPercentCorrect instead.
    const isAdaptive = MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT in composite;

    if (isAdaptive) {
      for (const name of Object.values(MULTICHOICE_COMPOSITE_SCORE_NAMES) as MultichoiceCompositeName[]) {
        const value = composite[name];
        if (value == null) continue;
        entries.push({
          type: COMPOSITE_RAW_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
          name,
          value: String(value),
          assessmentStage: AssessmentStage.TEST,
        });
      }
    } else {
      for (const name of Object.values(MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES) as MultichoiceNonAdaptiveName[]) {
        const value = composite[name];
        if (value == null) continue;
        entries.push({
          type: ScoreType.COMPUTED,
          domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE,
          name,
          value: String(value),
          assessmentStage: AssessmentStage.TEST,
        });
      }
    }
  }

  const comprehension = computed[MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION];
  if (comprehension) {
    for (const name of Object.values(MULTICHOICE_COMPREHENSION_SCORE_NAMES) as MultichoiceComprehensionName[]) {
      const value = comprehension[name];
      if (value == null) continue;
      entries.push({
        type: COMPREHENSION_RAW_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
        domain: MULTICHOICE_SCORE_DOMAINS.COMPOSITE_COMPREHENSION,
        name,
        value: String(value),
        assessmentStage: AssessmentStage.TEST,
      });
    }
  }

  return entries;
}
