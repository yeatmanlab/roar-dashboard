import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import {
  SRE_COMPOSITE_DOMAIN,
  SRE_PRACTICE_DOMAIN,
  SRE_COMPOSITE_SCORE_NAMES,
  SRE_SUBTASK_SCORE_NAME,
  type SreScoreName,
} from './score-names.js';

/**
 * Score entry shape for SRE scores written to run_scores.
 *
 * All SRE scores are type=COMPUTED — sreScore is derived (numCorrect - numIncorrect),
 * not a direct raw measurement. Normed scores (percentile, standardScore, etc.) are
 * also computed from the lookup table.
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
 * All SRE score entries are type=COMPUTED: sreScore is derived (numCorrect - numIncorrect),
 * not a raw measurement. All domains present in the computed output are emitted on every trial.
 *
 * - Composite domain: emits all SRE_COMPOSITE_SCORE_NAMES values that are present and non-null.
 * - All other domains (practice, lab, ai, etc.): emits only the sreScore.
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

    const assessmentStage = domain === SRE_PRACTICE_DOMAIN ? AssessmentStage.PRACTICE : AssessmentStage.TEST;

    if (domain === SRE_COMPOSITE_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter((k) => !RECOGNIZED_COMPOSITE_NAMES.has(k));
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in SRE composite domain: ${unrecognized.join(', ')}. ` +
              `Update SRE_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      // Object.values on an as-const object is inferred as string[] — cast to the literal union
      for (const name of Object.values(SRE_COMPOSITE_SCORE_NAMES) as SreScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        entries.push({
          type: ScoreType.COMPUTED,
          domain,
          name,
          value: String(value),
          assessmentStage,
        });
      }
    } else {
      // Non-composite domain (practice, lab, ai, etc.): emit only sreScore
      const sreScore = scores[SRE_SUBTASK_SCORE_NAME];
      if (sreScore == null) continue;
      entries.push({
        type: ScoreType.COMPUTED,
        domain,
        name: SRE_SUBTASK_SCORE_NAME,
        value: String(sreScore),
        assessmentStage,
      });
    }
  }

  return entries;
}
