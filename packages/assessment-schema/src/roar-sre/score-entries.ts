import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { domainToAssessmentStage } from '../score-utils.js';
import {
  SRE_COMPOSITE_SCORE_NAMES,
  SRE_RAW_COMPOSITE_SCORE_NAMES,
  SRE_SUBTASK_SCORE_NAMES,
  SRE_RAW_SUBTASK_SCORE_NAMES,
  type SreScoreName,
  type SreSubtaskScoreName,
} from './score-names.js';

/**
 * Score entry shape for SRE scores written to run_scores.
 *
 * - type=RAW: direct measurements (trial counts, thetaEstimateRaw, thetaSERaw). assessmentStage required.
 * - type=COMPUTED: derived values (sreScore, thetaEstimate, thetaSE, normed scores). assessmentStage required.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface SreScoreEntry {
  type: ScoreType;
  domain: string;
  name: SreScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = SreScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_COMPOSITE_NAMES = new Set<string>(Object.values(SRE_COMPOSITE_SCORE_NAMES));

/**
 * Converts SRE computed scores (from RoarScores.computedScoreCallback) to a flat array
 * of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Score type assignment:
 * - Composite domain: RAW for trial counts and thetaEstimateRaw/thetaSERaw; COMPUTED for
 *   sreScore, thetaEstimate, thetaSE, normed scores, and scoringVersion.
 * - Non-composite domains (practice, lab, ai, test1, test2, etc.): RAW for trial counts;
 *   COMPUTED for sreScore.
 *
 * assessmentStage is derived from the domain key:
 * - 'practice' → AssessmentStage.PRACTICE
 * - all others → AssessmentStage.TEST
 *
 * Returns `[]` when `computed` is null or undefined.
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized score name keys in the composite domain.
 *   Use in CI/test to catch new score names not yet handled by this function.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized composite score name is encountered
 */
export function toSreScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): SreScoreEntry[] {
  if (!computed) return [];

  const entries: SreScoreEntry[] = [];

  for (const [domain, scores] of Object.entries(computed)) {
    if (!scores || typeof scores !== 'object') continue;

    const assessmentStage = domainToAssessmentStage(domain);

    if (domain === COMPOSITE_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter((k) => !RECOGNIZED_COMPOSITE_NAMES.has(k));
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in SRE composite domain: ${unrecognized.join(', ')}. ` +
              `Update SRE_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      for (const name of Object.values(SRE_COMPOSITE_SCORE_NAMES) as SreScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        entries.push({
          type: SRE_RAW_COMPOSITE_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain,
          name,
          value: String(value),
          assessmentStage,
        });
      }
    } else {
      // Non-composite domain (practice, lab, ai, test1, test2, etc.):
      // emit sreScore (computed) and trial counts (raw).
      for (const name of Object.values(SRE_SUBTASK_SCORE_NAMES) as SreSubtaskScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        entries.push({
          type: SRE_RAW_SUBTASK_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain,
          name,
          value: String(value),
          assessmentStage,
        });
      }
    }
  }

  return entries;
}
