import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { SWR_SCORE_DOMAINS } from './domains.js';
import { SWR_SCORE_NAMES, SWR_RAW_SCORE_NAMES } from './score-names.js';
import type { SwrScoreName } from './score-names.js';

/**
 * Score entry shape for SWR scores written to run_scores.
 * Mirrors the api-contract ScoreEntry discriminated union without importing it
 * directly, keeping assessment-schema decoupled from api-contract at build time.
 *
 * - type=RAW: live state captured per trial (thetaEstimateRaw, counts). assessmentStage required.
 * - type=COMPUTED: shared-scale IRT estimate and normed/derived values (thetaEstimate,
 *   percentile, standardScore). assessmentStage present for SWR because all scores are
 *   stage-scoped, though the contract allows it absent.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface SwrScoreEntry {
  type: ScoreType;
  domain: string;
  name: SwrScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = SwrScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_DOMAINS = new Set<string>([SWR_SCORE_DOMAINS.COMPOSITE, SWR_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL]);

/**
 * Converts SWR computed scores (from RoarScores.computedScoreCallback) to a
 * flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Iterates all SWR_SCORE_NAMES and emits an entry for each field present and
 * non-null in the composite (and composite_foundational) domain. Score type is assigned per name:
 * - ScoreType.RAW for thetaEstimateRaw and trial counts
 * - ScoreType.COMPUTED for thetaEstimate and normed/derived scores (percentile, standardScore, roarScore)
 *
 * All entries carry assessmentStage: TEST because this function is only called
 * from the test-phase branch of the score adapter.
 *
 * Emits entries for both the `composite` and `composite_foundational` groups when present
 * (SWR's foundational composite equals its composite). Returns `[]` when `computed` is null
 * or no recognized score group is present.
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized domain keys. Use in
 *   CI/test to catch new domains that toSwrScoreEntries doesn't yet handle.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain key is encountered
 */
export function toSwrScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): SwrScoreEntry[] {
  if (!computed) return [];

  if (strict) {
    const unrecognized = Object.keys(computed).filter((k) => !RECOGNIZED_DOMAINS.has(k));
    if (unrecognized.length > 0) {
      throw new Error(
        `Unrecognized score domains in SWR computed scores: ${unrecognized.join(', ')}. ` +
          `Update toSwrScoreEntries to handle the new domain.`,
      );
    }
  }

  const entries: SwrScoreEntry[] = [];

  // SWR's foundational composite equals its composite (SWR defines the shared scale), so the
  // scoring callback mirrors the composite group under composite_foundational. Emit entries
  // for each present group — the backend foundational composite reads composite_foundational.
  for (const domain of [SWR_SCORE_DOMAINS.COMPOSITE, SWR_SCORE_DOMAINS.COMPOSITE_FOUNDATIONAL]) {
    const group = computed[domain];
    if (!group) continue;

    for (const name of Object.values(SWR_SCORE_NAMES) as SwrScoreName[]) {
      const value = group[name];
      if (value == null) continue;
      entries.push({
        type: SWR_RAW_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
        domain,
        name,
        value: String(value),
        assessmentStage: AssessmentStage.TEST,
      });
    }
  }

  return entries;
}
