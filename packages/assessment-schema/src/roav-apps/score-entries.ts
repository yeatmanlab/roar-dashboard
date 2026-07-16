import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { domainToAssessmentStage } from '../score-utils.js';
import { ROAV_APPS_SCORE_DOMAINS, ROAV_APPS_STAGE_KEYS } from './domains.js';
import { ROAV_APPS_COMPOSITE_SCORE_NAMES, ROAV_APPS_RAW_COMPOSITE_SCORE_NAMES } from './score-names.js';
import type { RoavAppsScoreName } from './score-names.js';

/**
 * Score entry shape for roav-apps (roav-mp, roav-rvp) scores written to run_scores.
 *
 * - `type=raw`: trial counts (numAttempted/numCorrect/numIncorrect) — direct measurements.
 * - `type=computed`: shared-scale IRT estimates (thetaEstimate/thetaSE). roav-apps emits
 *   these null, so in practice only raw counts are written.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface RoavAppsScoreEntry {
  type: ScoreType;
  domain: string;
  name: RoavAppsScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _TypeCheck = RoavAppsScoreEntry extends ScoreEntryConstraint ? true : false;

const KNOWN_DOMAINS = new Set<string>(Object.values(ROAV_APPS_SCORE_DOMAINS));
const KNOWN_STAGE_KEYS = new Set<string>(Object.values(ROAV_APPS_STAGE_KEYS));

/**
 * Converts roav-apps computed scores (from the scoring callback) to a flat array of
 * ScoreEntry objects suitable for the backend run_scores table.
 *
 * The `computed` object is **domain-keyed at the top level with the stage nested underneath**.
 * The top-level key is always `composite`; each nested stage holds that stage's counts:
 *
 * ```
 * { composite: {
 *     practice: { numAttempted, numCorrect, numIncorrect, thetaEstimate, thetaSE },
 *     test:     { numAttempted, numCorrect, numIncorrect, thetaEstimate, thetaSE },
 * } }
 * ```
 *
 * Each entry is written under the top-level `composite` domain; the nested stage key selects
 * run_scores.assessment_stage via `domainToAssessmentStage` (`practice` → PRACTICE, any other
 * key → TEST). This is the run_scores form of the legacy `scores.raw.composite.{practice,test}`
 * structure. Null/undefined values are skipped, so the null theta fields produce no rows.
 *
 * Score type assignment: trial counts → RAW; thetaEstimate/thetaSE → COMPUTED.
 *
 * Returns `[]` when `computed` is null or undefined.
 *
 * @param computed - Domain-keyed, stage-nested computed scores from the callback, or null
 * @param options.strict - If true, throw on an unrecognized top-level domain or nested stage
 *   key. Use in CI/tests to catch a callback emitting a shape the adapter doesn't handle. When
 *   false (default), entries are emitted only for the canonical domain(s) — an unrecognized
 *   top-level key is ignored, never written through to run_scores.domain.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain or stage key is encountered
 */
export function toRoavAppsScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): RoavAppsScoreEntry[] {
  if (!computed) return [];

  // In strict mode, reject unexpected top-level domains up front — catches a callback emitting
  // a shape the adapter doesn't handle (CI/tests).
  if (strict) {
    const unrecognized = Object.keys(computed).filter((key) => !KNOWN_DOMAINS.has(key));
    if (unrecognized.length > 0) {
      throw new Error(
        `Unrecognized roav-apps score domain(s): ${unrecognized.join(', ')}. Expected: ${[...KNOWN_DOMAINS].join(', ')}.`,
      );
    }
  }

  const entries: RoavAppsScoreEntry[] = [];

  // Iterate the canonical domain constants and look up computed[domain] — never the callback's
  // raw keys — so run_scores.domain is always a known value even in non-strict mode (a typo'd
  // or unexpected top-level key is skipped rather than written through).
  for (const domain of Object.values(ROAV_APPS_SCORE_DOMAINS)) {
    const stages = computed[domain];
    if (!stages || typeof stages !== 'object') continue;

    for (const [stageKey, scores] of Object.entries(stages)) {
      if (!scores || typeof scores !== 'object') continue;

      if (strict && !KNOWN_STAGE_KEYS.has(stageKey)) {
        throw new Error(
          `Unrecognized roav-apps stage key "${stageKey}" in domain "${domain}". ` +
            `Expected one of: ${[...KNOWN_STAGE_KEYS].join(', ')}.`,
        );
      }

      const assessmentStage = domainToAssessmentStage(stageKey);
      const scoreObj = scores as Record<string, unknown>;

      for (const name of Object.values(ROAV_APPS_COMPOSITE_SCORE_NAMES) as RoavAppsScoreName[]) {
        const value = scoreObj[name];
        if (value == null) continue;
        entries.push({
          type: ROAV_APPS_RAW_COMPOSITE_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
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
