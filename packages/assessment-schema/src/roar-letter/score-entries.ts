import type { ScoreEntryConstraint } from '../types/score-entry.type.js';
import { COMPOSITE_DOMAIN, COMPOSITE_FOUNDATIONAL_DOMAIN } from '../constants/common-domains.js';
import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';
import { LETTER_SUBTASK_DOMAINS } from './domains.js';
import {
  LETTER_COMPOSITE_SCORE_NAMES,
  LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES,
  LETTER_RAW_COMPOSITE_SCORE_NAMES,
  LETTER_RAW_FOUNDATIONAL_SCORE_NAMES,
  LETTER_SUBTASK_SCORE_NAMES,
  PHONICS_COMPOSITE_SCORE_NAMES,
  PHONICS_RAW_COMPOSITE_SCORE_NAMES,
  PHONICS_SUBTASK_SCORE_NAMES,
  PHONICS_GROUP_SCORE_NAMES,
  type LetterScoreName,
  type LetterCompositeScoreName,
  type LetterCompositeFoundationalScoreName,
  type LetterSubtaskScoreName,
  type PhonicsScoreName,
  type PhonicsGroupScoreName,
} from './score-names.js';

// ─── Letter score entries ─────────────────────────────────────────────────────

/**
 * Score entry shape for letter scores written to run_scores.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface LetterScoreEntry {
  type: ScoreType;
  domain: string;
  name: LetterScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _LetterTypeCheck = LetterScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_LETTER_COMPOSITE_NAMES = new Set<string>(Object.values(LETTER_COMPOSITE_SCORE_NAMES));
const RECOGNIZED_LETTER_COMPOSITE_FOUNDATIONAL_NAMES = new Set<string>(
  Object.values(LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES),
);
const KNOWN_LETTER_SUBTASK_DOMAINS = new Set<string>(Object.values(LETTER_SUBTASK_DOMAINS));

/**
 * Letter subtask domain → AssessmentStage mapping.
 * Domain names containing 'Practice' (LetterPractice, PhonemePractice) map to
 * PRACTICE; all other domains (LowercaseNames, UppercaseNames, Phonemes,
 * composite, composite_foundational) map to TEST.
 */
function letterDomainToAssessmentStage(domain: string): AssessmentStage {
  return domain.includes('Practice') ? AssessmentStage.PRACTICE : AssessmentStage.TEST;
}

/**
 * Converts letter computed scores (from RoarScores.computedScoreCallback) to a flat
 * array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Score type assignment:
 * - composite domain: RAW for thetaEstimateRaw, thetaSERaw, totalCorrect, totalNumAttempted;
 *   COMPUTED for everything else (thetaEstimate, thetaSE, normed scores, metadata).
 * - composite_foundational domain: RAW for thetaEstimateRaw and thetaSERaw (native-scale IRT
 *   estimates); COMPUTED for everything else (scaled estimates, metadata).
 * - Subtask domains (LetterPractice, LowercaseNames, UppercaseNames, PhonemePractice,
 *   Phonemes): COMPUTED for all scores (subScore, subPercentCorrect, item lists).
 *
 * assessmentStage mapping: domains containing 'Practice' → PRACTICE; all others → TEST.
 *
 * Returns `[]` when `computed` is null or undefined. This is the expected behavior for
 * letter-es and letter-en-ca, where computedScoreCallback returns null.
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized score names in composite domains or
 *   unrecognized subtask domain keys. Use in tests to catch schema drift when the game emits
 *   new domains or score names not yet listed in KNOWN_LETTER_SUBTASK_DOMAINS or score-names.ts.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized composite score name or subtask domain is encountered
 */
export function toLetterScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): LetterScoreEntry[] {
  if (!computed) return [];

  const entries: LetterScoreEntry[] = [];

  for (const [domain, scores] of Object.entries(computed)) {
    if (!scores || typeof scores !== 'object') continue;

    const assessmentStage = letterDomainToAssessmentStage(domain);

    if (domain === COMPOSITE_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter((k) => !RECOGNIZED_LETTER_COMPOSITE_NAMES.has(k));
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in letter composite domain: ${unrecognized.join(', ')}. ` +
              `Update LETTER_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      for (const name of Object.values(LETTER_COMPOSITE_SCORE_NAMES) as LetterCompositeScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        const strValue = String(value);
        if (!strValue) continue; // String([]) === '' — skip empty item lists
        entries.push({
          type: LETTER_RAW_COMPOSITE_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain,
          name,
          value: strValue,
          assessmentStage,
        });
      }
    } else if (domain === COMPOSITE_FOUNDATIONAL_DOMAIN) {
      if (strict) {
        const unrecognized = Object.keys(scores).filter((k) => !RECOGNIZED_LETTER_COMPOSITE_FOUNDATIONAL_NAMES.has(k));
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in letter composite_foundational domain: ${unrecognized.join(', ')}. ` +
              `Update LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      for (const name of Object.values(
        LETTER_COMPOSITE_FOUNDATIONAL_SCORE_NAMES,
      ) as LetterCompositeFoundationalScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        const strValue = String(value);
        if (!strValue) continue; // String([]) === '' — skip empty item lists
        entries.push({
          type: LETTER_RAW_FOUNDATIONAL_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain,
          name,
          value: strValue,
          assessmentStage,
        });
      }
    } else {
      // Subtask domain: LetterPractice, LowercaseNames, UppercaseNames, PhonemePractice, Phonemes
      if (strict && !KNOWN_LETTER_SUBTASK_DOMAINS.has(domain)) {
        throw new Error(
          `Unrecognized letter subtask domain: "${domain}". ` +
            `Update KNOWN_LETTER_SUBTASK_DOMAINS in score-entries.ts to handle the new domain.`,
        );
      }
      for (const name of Object.values(LETTER_SUBTASK_SCORE_NAMES) as LetterSubtaskScoreName[]) {
        const value = scores[name];
        if (value == null) continue;
        const strValue = String(value);
        if (!strValue) continue; // String([]) === '' — skip empty item lists
        entries.push({
          type: ScoreType.COMPUTED,
          domain,
          name,
          value: strValue,
          assessmentStage,
        });
      }
    }
  }

  return entries;
}

// ─── Phonics score entries ────────────────────────────────────────────────────

/**
 * Score entry shape for phonics scores written to run_scores.
 *
 * Compile-time assertion below ensures this stays assignable to the api-contract shape.
 */
export interface PhonicsScoreEntry {
  type: ScoreType;
  domain: string;
  name: PhonicsScoreName;
  value: string;
  assessmentStage: AssessmentStage;
}

export type _PhonicsTypeCheck = PhonicsScoreEntry extends ScoreEntryConstraint ? true : false;

const RECOGNIZED_PHONICS_COMPOSITE_NAMES = new Set<string>(Object.values(PHONICS_COMPOSITE_SCORE_NAMES));

/**
 * Maps group keys from scores.js composite.subscores to flat run_scores field names.
 * scores.js produces snake_case keys (initial_blend, tri_blend, etc.) — these must match
 * exactly. Values are the flat camelCase field names expected by phonics.json.
 */
const PHONICS_SUBSCORE_GROUPS = {
  cvc: { correct: PHONICS_GROUP_SCORE_NAMES.CVC_CORRECT, attempted: PHONICS_GROUP_SCORE_NAMES.CVC_ATTEMPTED },
  digraph: {
    correct: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.DIGRAPH_ATTEMPTED,
  },
  initial_blend: {
    correct: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.INITIAL_BLEND_ATTEMPTED,
  },
  tri_blend: {
    correct: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.TRI_BLEND_ATTEMPTED,
  },
  final_blend: {
    correct: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.FINAL_BLEND_ATTEMPTED,
  },
  r_controlled: {
    correct: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.R_CONTROLLED_ATTEMPTED,
  },
  r_cluster: {
    correct: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.R_CLUSTER_ATTEMPTED,
  },
  silent_e: {
    correct: PHONICS_GROUP_SCORE_NAMES.SILENT_E_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.SILENT_E_ATTEMPTED,
  },
  vowel_team: {
    correct: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_CORRECT,
    attempted: PHONICS_GROUP_SCORE_NAMES.VOWEL_TEAM_ATTEMPTED,
  },
} as const satisfies Record<string, { correct: PhonicsGroupScoreName; attempted: PhonicsGroupScoreName }>;

/**
 * Converts phonics computed scores (from RoarScores.computedScoreCallback) to a flat
 * array of ScoreEntry objects suitable for the backend run_scores table.
 *
 * Score type assignment:
 * - composite domain: RAW for totalCorrect, totalNumAttempted; COMPUTED for everything
 *   else (totalPercentCorrect, group subscores flattened from subscores, metadata).
 * - Non-composite domains: COMPUTED for subScore and subPercentCorrect.
 *
 * All phonics domains → assessmentStage=TEST (no practice phase).
 *
 * Group subscores flattening: scores.js produces composite.subscores = { cvc: { correct,
 * attempted }, … }. This function iterates PHONICS_SUBSCORE_GROUPS and maps each group to
 * its flat field names (cvcCorrect / cvcAttempted, etc.) matching phonics.json exactly.
 *
 * Returns `[]` when `computed` is null or undefined.
 *
 * @param computed - Nested computed scores from RoarScores.computedScoreCallback, or null
 * @param options.strict - If true, throw on unrecognized top-level score names in composite.
 * @returns Array of ScoreEntry objects ready for backend upsert
 * @throws {Error} If strict=true and an unrecognized composite score name is encountered
 */
export function toPhonicsScoreEntries(
  computed: Record<string, Record<string, unknown>> | null | undefined,
  { strict = false } = {},
): PhonicsScoreEntry[] {
  if (!computed) return [];

  const entries: PhonicsScoreEntry[] = [];

  for (const [domain, scores] of Object.entries(computed)) {
    if (!scores || typeof scores !== 'object') continue;

    // All phonics domains are TEST — phonics has no practice phase.
    const assessmentStage = AssessmentStage.TEST;

    if (domain === COMPOSITE_DOMAIN) {
      if (strict) {
        // Strict check covers only top-level keys (not subscores children)
        const unrecognized = Object.keys(scores).filter(
          (k) => k !== 'subscores' && !RECOGNIZED_PHONICS_COMPOSITE_NAMES.has(k),
        );
        if (unrecognized.length > 0) {
          throw new Error(
            `Unrecognized score names in phonics composite domain: ${unrecognized.join(', ')}. ` +
              `Update PHONICS_COMPOSITE_SCORE_NAMES to handle the new score name.`,
          );
        }
      }

      // Top-level composite fields (totalCorrect, totalNumAttempted, etc.)
      for (const name of Object.values(PHONICS_COMPOSITE_SCORE_NAMES)) {
        const value = scores[name];
        if (value == null) continue;
        const strValue = String(value);
        if (!strValue) continue; // String([]) === '' — skip empty item lists
        entries.push({
          type: PHONICS_RAW_COMPOSITE_SCORE_NAMES.has(name) ? ScoreType.RAW : ScoreType.COMPUTED,
          domain,
          name,
          value: strValue,
          assessmentStage,
        });
      }

      // Flatten nested subscores: { cvc: { correct, attempted }, … } → flat entries
      const subscores = scores['subscores'];
      if (subscores != null && typeof subscores === 'object') {
        for (const [group, groupData] of Object.entries(
          subscores as Record<string, { correct?: unknown; attempted?: unknown }>,
        )) {
          const mapping = PHONICS_SUBSCORE_GROUPS[group as keyof typeof PHONICS_SUBSCORE_GROUPS];
          if (!mapping) continue;

          if (groupData.correct != null) {
            const strCorrect = String(groupData.correct);
            if (strCorrect) {
              entries.push({
                type: ScoreType.COMPUTED,
                domain,
                name: mapping.correct,
                value: strCorrect,
                assessmentStage,
              });
            }
          }
          if (groupData.attempted != null) {
            const strAttempted = String(groupData.attempted);
            if (strAttempted) {
              entries.push({
                type: ScoreType.COMPUTED,
                domain,
                name: mapping.attempted,
                value: strAttempted,
                assessmentStage,
              });
            }
          }
        }
      }
    } else {
      // Non-composite subtask domain
      for (const name of Object.values(PHONICS_SUBTASK_SCORE_NAMES)) {
        const value = scores[name];
        if (value == null) continue;
        const strValue = String(value);
        if (!strValue) continue; // String([]) === '' — skip empty item lists
        entries.push({
          type: ScoreType.COMPUTED,
          domain,
          name,
          value: strValue,
          assessmentStage,
        });
      }
    }
  }

  return entries;
}
