/**
 * Seed config for ROAR Letter Names and Sounds / Phonics.
 *
 * Two task families are supported, distinguished by the required `task` param:
 *
 * - **Letter** (`params.task === "letter"`): Letter-name and letter-sound identification.
 *   Requires `params.language` to route to the correct language-specific backend task
 *   (letter-en, letter-es, letter-en-ca). Unsupported languages are skipped gracefully.
 *
 * - **Phonics** (`params.task === "phonics"`): Phonics decoding. Always seeded under the
 *   single English phonics task — no language routing.
 *
 * scoringVersion validation only applies to letter tasks (phonics has no scoring versions
 * in the schema).
 */
import { letter } from '@roar-platform/assessment-schema';

import type { TaskSeedConfig } from '../task-seed-configs';

const { LETTER_TASK_IDS, PHONICS_TASK_IDS, LETTER_LANGUAGES, LETTER_SCORING_VERSION } = letter;

const VALID_SCORING_VERSIONS = new Set(Object.values(LETTER_SCORING_VERSION));
const SUPPORTED_LANGUAGES = new Set(Object.keys(LETTER_LANGUAGES));

export const letterConfig: TaskSeedConfig = {
  tasks: {
    [LETTER_TASK_IDS.EN]: {
      name: 'Letter',
      nameSimple: 'Letter',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter',
    },
    [LETTER_TASK_IDS.ES]: {
      name: 'Letter (Spanish)',
      nameSimple: 'Letter-ES',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter (Spanish)',
    },
    [LETTER_TASK_IDS.EN_CA]: {
      name: 'Letter (English (Canada))',
      nameSimple: 'Letter-EN-CA',
      nameTechnical: 'Rapid Online Assessment of Reading — Letter (English (Canada))',
    },
    [PHONICS_TASK_IDS.EN]: {
      name: 'Phonics',
      nameSimple: 'Phonics',
      nameTechnical: 'Rapid Online Assessment of Reading — Phonics',
    },
  },
  validateVariant(loc, params) {
    const task = params.task as string | undefined;
    if (task !== 'letter' && task !== 'phonics') {
      throw new Error(`${loc}: "task" must be "letter" or "phonics", got "${task}"`);
    }

    if (task === 'letter') {
      const language = params.language as string | undefined;
      if (!language) throw new Error(`${loc}: "language" is required for letter tasks`);

      // Gracefully skip languages not yet supported by the backend (return false = skip).
      // Language keys are case-sensitive (e.g., "en", "es", "en-CA").
      if (!SUPPORTED_LANGUAGES.has(language)) {
        return false;
      }

      // scoringVersion validation only applies to letter tasks, not phonics
      const scoringVersion = params.scoringVersion as number | null | undefined;
      if (scoringVersion !== undefined && scoringVersion !== null) {
        if (!VALID_SCORING_VERSIONS.has(scoringVersion)) {
          throw new Error(
            `${loc}: invalid scoringVersion ${scoringVersion}. Valid: ${[...VALID_SCORING_VERSIONS].join(', ')}`,
          );
        }
      }
    }
  },
  /**
   * Routes variants to their task by `params.task` and `params.language`:
   * - phonics → single English phonics task
   * - letter + language → language-specific letter task (en, es, en-CA)
   */
  resolveTaskId(params) {
    const language = params.language as string | undefined;
    const task = params.task as string | undefined;
    if (task === 'phonics') return PHONICS_TASK_IDS.EN;
    if (!language || language === 'en') return LETTER_TASK_IDS.EN;
    if (language === 'es') return LETTER_TASK_IDS.ES;
    if (language === 'en-CA' || language === 'en-ca') return LETTER_TASK_IDS.EN_CA;
    throw new Error(`Unknown letter language "${language}"`);
  },
};
