import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import {
  ROAM_FLUENCY_SUBTASK_DOMAINS,
  ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS,
  ROAM_ALPACA_SUBTASK_DOMAINS,
} from './domains.js';
import {
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES,
  ROAM_FLUENCY_RAW_SUBTASK_SCORE_NAMES,
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES,
  ROAM_FLUENCY_RAW_COMPOSITE_SCORE_NAMES,
  ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES,
  ROAM_ALPACA_SUBTASK_SCORE_NAMES,
  ROAM_ALPACA_RAW_SUBTASK_SCORE_NAMES,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES,
  ROAM_ALPACA_RAW_COMPOSITE_SCORE_NAMES,
} from './score-names.js';
import type { RoamFluencyScoreName, RoamFluencyIncorrectSkillsScoreName, RoamAlpacaScoreName } from './score-names.js';

/**
 * Reads every known name in `names` off `scores`, skipping absent/empty values, and
 * pushes one entry per present field. `names`/`rawNames` are always vocabulary
 * supersets, so a field this run's shape doesn't happen to populate is simply never
 * found on `scores`, not specially cased.
 */
function pushScoreEntries<TName extends string>(
  entries: Array<{ type: ScoreType; domain: string; name: TName; value: string; assessmentStage: AssessmentStage }>,
  scores: Record<string, unknown>,
  names: Record<string, TName>,
  rawNames: ReadonlySet<TName>,
  domain: string,
) {
  for (const name of Object.values(names)) {
    const value = scores[name];
    if (value == null) continue;
    const strValue = String(value);
    if (!strValue) continue; // String([]) === '' — skip empty item/skill lists
    entries.push({
      type: rawNames.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
      domain,
      name,
      value: strValue,
      assessmentStage: AssessmentStage.TEST,
    });
  }
}

// ─── Roam fluency score entries ───────────────────────────────────────────────

/**
 * Score entry shape for roam fluency (fluency-arf, fluency-calf, and their -es/-pt
 * variants) scores written to run_scores.
 */
export interface RoamFluencyScoreEntry {
  type: ScoreType;
  domain: string;
  name: RoamFluencyScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _RoamFluencyTypeCheck = RoamFluencyScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_ROAM_FLUENCY_COMPOSITE_NAMES = new Set<string>(Object.values(ROAM_FLUENCY_COMPOSITE_SCORE_NAMES));

const KNOWN_FLUENCY_SUBTASK_DOMAINS = new Set<string>([
  ...Object.values(ROAM_FLUENCY_SUBTASK_DOMAINS),
  ...Object.values(ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS),
]);

/**
 * Maps an operator key from composite.incorrectSkills to its flat run_scores name.
 * An operator not present here is skipped rather than written under an invented name.
 */
const ROAM_FLUENCY_INCORRECT_SKILLS_GROUPS = {
  addition: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.ADDITION_INCORRECT_SKILLS,
  division: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.DIVISION_INCORRECT_SKILLS,
  multiplication: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.MULTIPLICATION_INCORRECT_SKILLS,
  subtraction: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.SUBTRACTION_INCORRECT_SKILLS,
} as const satisfies Record<string, RoamFluencyIncorrectSkillsScoreName>;

/**
 * Converts roam fluency computed scores (from RoarScores.computedScoreCallback) to a
 * flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Score type assignment:
 * - composite domain: RAW for numCorrect, numIncorrect, numAttempted; COMPUTED for
 *   everything else — rawScore is a derived formula despite its name, subPercentCorrect
 *   is a ratio, and the flattened incorrectSkills entries are formatted skill lists.
 * - Subtask domains (addition, division, multiplication, subtraction, symbolicComp,
 *   and the responseModality domains FC/FR/rtControl_*): RAW for numCorrect,
 *   numIncorrect, numAttempted; COMPUTED for rawScore, subPercentCorrect,
 *   skillsAssessed. symbolicComp and the responseModality domains only ever populate
 *   the 4 base fields, so the extra fields are simply absent for those domains.
 *
 * composite.incorrectSkills = { multiplication: '6x7, 8x9', division: '9/3' } is a
 * nested object keyed by operator; each key is mapped via
 * ROAM_FLUENCY_INCORRECT_SKILLS_GROUPS to its flat field name. Unlike roam-alpaca's
 * composite.incorrectSkills, which is always a single joined string, this is always
 * nested for fluency.
 *
 * All domains → assessmentStage=TEST. Returns `[]` when `computed` is null or undefined.
 *
 * @param computed - Domain-keyed computed scores from computedScoreCallback, or null
 * @param options.strict - If true, throw on an unrecognized top-level domain or an
 *   unrecognized score name in the composite domain, instead of skipping it silently.
 * @returns Array of RoamFluencyScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain or composite score name is encountered
 */
export function toRoamFluencyScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): RoamFluencyScoreEntry[] {
  if (!computed) return [];

  const entries: RoamFluencyScoreEntry[] = [];

  for (const [domain, scores] of Object.entries(computed)) {
    if (!scores || typeof scores !== 'object') continue;

    if (domain === COMPOSITE_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter(
          (k) => k !== 'incorrectSkills' && !RECOGNIZED_ROAM_FLUENCY_COMPOSITE_NAMES.has(k),
        );
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in roam fluency composite domain: ${unrecognized.join(', ')}. ` +
              `Update ROAM_FLUENCY_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      pushScoreEntries(
        entries,
        scores,
        ROAM_FLUENCY_COMPOSITE_SCORE_NAMES,
        ROAM_FLUENCY_RAW_COMPOSITE_SCORE_NAMES,
        domain,
      );

      const incorrectSkills = scores['incorrectSkills'];
      if (incorrectSkills != null && typeof incorrectSkills === 'object') {
        for (const [operator, skillValue] of Object.entries(incorrectSkills as Record<string, unknown>)) {
          const name =
            ROAM_FLUENCY_INCORRECT_SKILLS_GROUPS[operator as keyof typeof ROAM_FLUENCY_INCORRECT_SKILLS_GROUPS];
          if (!name || skillValue == null) continue;
          const strValue = String(skillValue);
          if (!strValue) continue;
          entries.push({
            type: ScoreType.COMPUTED,
            domain,
            name,
            value: strValue,
            assessmentStage: AssessmentStage.TEST,
          });
        }
      }

      continue;
    }

    if (!KNOWN_FLUENCY_SUBTASK_DOMAINS.has(domain)) {
      if (strict) {
        throw new Error(
          `Unrecognized roam fluency score domain "${domain}". Expected "${COMPOSITE_DOMAIN}" or one of: ${[...KNOWN_FLUENCY_SUBTASK_DOMAINS].join(', ')}.`,
        );
      }
      continue;
    }

    pushScoreEntries(entries, scores, ROAM_FLUENCY_SUBTASK_SCORE_NAMES, ROAM_FLUENCY_RAW_SUBTASK_SCORE_NAMES, domain);
  }

  return entries;
}

// ─── Roam alpaca score entries ────────────────────────────────────────────────

/**
 * Score entry shape for roam-alpaca (and its -es/-pt variants) scores written to
 * run_scores.
 */
export interface RoamAlpacaScoreEntry {
  type: ScoreType;
  domain: string;
  name: RoamAlpacaScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _RoamAlpacaTypeCheck = RoamAlpacaScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_ROAM_ALPACA_COMPOSITE_NAMES = new Set<string>(Object.values(ROAM_ALPACA_COMPOSITE_SCORE_NAMES));

const KNOWN_ALPACA_SUBTASK_DOMAINS = new Set<string>(Object.values(ROAM_ALPACA_SUBTASK_DOMAINS));

/**
 * Converts roam-alpaca computed scores (from RoarScores.computedScoreCallback) to a
 * flat array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Score type assignment:
 * - composite domain: RAW for numCorrect, numIncorrect, numAttempted, and
 *   thetaEstimateRaw (native-scale IRT estimate); COMPUTED for everything else —
 *   thetaEstimate is the shared-scale calibrated estimate, roarScore and rawScore are
 *   both derived formulas despite their names, gradeEstimate/supportLevel are looked
 *   up from gradeEstimateObject, and incorrectSkills is a formatted string.
 * - Subtask domains (numberKnowledge, geometry, arithmeticExpressions,
 *   rationalNumbersProbability, algebraicThinking, numberLine): RAW for numCorrect,
 *   numIncorrect, numAttempted; COMPUTED for rawScore, subPercentCorrect,
 *   gradeEstimate, supportLevel. numberLine only ever populates the 4 base fields, so
 *   the extra fields are simply absent for that domain.
 *
 * composite.incorrectSkills here is always a single comma-joined string, never a
 * nested object, so it's read as one more flat composite field — no group flattening
 * needed, unlike roam fluency.
 *
 * All domains → assessmentStage=TEST. Returns `[]` when `computed` is null or undefined.
 *
 * @param computed - Domain-keyed computed scores from computedScoreCallback, or null
 * @param options.strict - If true, throw on an unrecognized top-level domain or an
 *   unrecognized score name in the composite domain, instead of skipping it silently.
 * @returns Array of RoamAlpacaScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized domain or composite score name is encountered
 */
export function toRoamAlpacaScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): RoamAlpacaScoreEntry[] {
  if (!computed) return [];

  const entries: RoamAlpacaScoreEntry[] = [];

  for (const [domain, scores] of Object.entries(computed)) {
    if (!scores || typeof scores !== 'object') continue;

    if (domain === COMPOSITE_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter((k) => !RECOGNIZED_ROAM_ALPACA_COMPOSITE_NAMES.has(k));
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in roam-alpaca composite domain: ${unrecognized.join(', ')}. ` +
              `Update ROAM_ALPACA_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      pushScoreEntries(
        entries,
        scores,
        ROAM_ALPACA_COMPOSITE_SCORE_NAMES,
        ROAM_ALPACA_RAW_COMPOSITE_SCORE_NAMES,
        domain,
      );
      continue;
    }

    if (!KNOWN_ALPACA_SUBTASK_DOMAINS.has(domain)) {
      if (strict) {
        throw new Error(
          `Unrecognized roam-alpaca score domain "${domain}". Expected "${COMPOSITE_DOMAIN}" or one of: ${[...KNOWN_ALPACA_SUBTASK_DOMAINS].join(', ')}.`,
        );
      }
      continue;
    }

    pushScoreEntries(entries, scores, ROAM_ALPACA_SUBTASK_SCORE_NAMES, ROAM_ALPACA_RAW_SUBTASK_SCORE_NAMES, domain);
  }

  return entries;
}
