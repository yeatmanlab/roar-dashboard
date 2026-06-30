import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { LEVANTE_SCORE_DOMAINS } from './domains.js';
import { LEVANTE_SCORE_NAMES, LEVANTE_RAW_SCORE_NAMES } from './score-names.js';
import type { LevanteScoreName } from './score-names.js';

const RECOGNIZED_DOMAINS = new Set<string>(Object.values(LEVANTE_SCORE_DOMAINS));

/**
 * Score entry shape for LEVANTE task scores written to run_scores.
 *
 * - type=RAW: native-scale IRT estimates (thetaEstimateRaw, thetaSERaw)
 * - type=COMPUTED: all other scores (normed: thetaEstimate, roarScore, percentile,
 *   standardScore, scoringVersion; unnormed: totalCorrect, totalNumAttempted,
 *   totalPercentCorrect)
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface LevanteScoreEntry {
  type: ScoreType;
  domain: string;
  name: LevanteScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = LevanteScoreEntry extends ScoreEntryConstraint ? true : false;

/**
 * Converts LEVANTE computed scores to a flat array of ScoreEntry objects
 * suitable for the backend run_scores table.
 *
 * Handles both normed tasks (trog, roar-inference) and unnormed tasks
 * (egma-math, matrix-reasoning, etc.) — iterates all LEVANTE_SCORE_NAMES
 * and emits an entry for each field that is present and non-null in the
 * composite domain. Fields absent from the computed object are skipped, so
 * normed tasks produce IRT/normed entries and unnormed tasks produce
 * totalCorrect/totalNumAttempted/totalPercentCorrect entries from the same
 * function.
 *
 * Score type is assigned per name:
 * - ScoreType.RAW for thetaEstimateRaw, thetaSERaw, totalCorrect, totalNumAttempted
 * - ScoreType.COMPUTED for all other scores
 *
 * All entries carry assessmentStage: TEST. Returns [] when computed is
 * null/undefined or the composite domain is absent.
 *
 * @param computed - Nested computed scores from ScoringHandler.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized domain keys. Use in
 *   CI/test to catch new domains that toLevanteScoreEntries doesn't yet handle.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain key is encountered
 */
export function toLevanteScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): LevanteScoreEntry[] {
  if (!computed) return [];

  if (strict) {
    const unrecognized = Object.keys(computed).filter((k) => !RECOGNIZED_DOMAINS.has(k));
    if (unrecognized.length > 0) {
      throw new Error(
        `Unrecognized score domains in LEVANTE computed scores: ${unrecognized.join(', ')}. ` +
          `Update toLevanteScoreEntries to handle the new domain.`,
      );
    }
  }

  const group = computed[LEVANTE_SCORE_DOMAINS.COMPOSITE];
  if (!group) return [];

  const entries: LevanteScoreEntry[] = [];

  for (const name of Object.values(LEVANTE_SCORE_NAMES) as LevanteScoreName[]) {
    const value = group[name];
    if (value == null) continue;
    entries.push({
      type: LEVANTE_RAW_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
      domain: LEVANTE_SCORE_DOMAINS.COMPOSITE,
      name,
      value: String(value),
      assessmentStage: AssessmentStage.TEST,
    });
  }

  return entries;
}
