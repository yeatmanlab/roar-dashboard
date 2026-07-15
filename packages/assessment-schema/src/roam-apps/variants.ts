import type { RoamFluencyArfId, RoamFluencyCalfId, RoamAlpacaId } from './config.js';
import { ROAM_FLUENCY_ARF_TASK_IDS, ROAM_FLUENCY_CALF_TASK_IDS, ROAM_ALPACA_TASK_IDS } from './config.js';

type RoamLanguageEntry<TaskId> = {
  code: string;
  label: string;
  taskId: TaskId;
};

/**
 * Languages the fluency-arf task ships variants for. Each language is a
 * separate task in the backend (distinct task ID), mirroring the SWR/SRE/letter
 * pattern. Keyed by the same lowercase code used in ROAM_FLUENCY_ARF_TASK_IDS.
 */
export const ROAM_FLUENCY_ARF_LANGUAGES = {
  en: { code: 'en', label: 'English', taskId: ROAM_FLUENCY_ARF_TASK_IDS.EN },
  es: { code: 'es', label: 'Spanish', taskId: ROAM_FLUENCY_ARF_TASK_IDS.ES },
  pt: { code: 'pt', label: 'Portuguese', taskId: ROAM_FLUENCY_ARF_TASK_IDS.PT },
} as const satisfies Record<string, RoamLanguageEntry<RoamFluencyArfId>>;

/**
 * Languages the fluency-calf task ships variants for. See ROAM_FLUENCY_ARF_LANGUAGES.
 */
export const ROAM_FLUENCY_CALF_LANGUAGES = {
  en: { code: 'en', label: 'English', taskId: ROAM_FLUENCY_CALF_TASK_IDS.EN },
  es: { code: 'es', label: 'Spanish', taskId: ROAM_FLUENCY_CALF_TASK_IDS.ES },
  pt: { code: 'pt', label: 'Portuguese', taskId: ROAM_FLUENCY_CALF_TASK_IDS.PT },
} as const satisfies Record<string, RoamLanguageEntry<RoamFluencyCalfId>>;

/**
 * Languages the roam-alpaca task ships variants for. See ROAM_FLUENCY_ARF_LANGUAGES.
 */
export const ROAM_ALPACA_LANGUAGES = {
  en: { code: 'en', label: 'English', taskId: ROAM_ALPACA_TASK_IDS.EN },
  es: { code: 'es', label: 'Spanish', taskId: ROAM_ALPACA_TASK_IDS.ES },
  pt: { code: 'pt', label: 'Portuguese', taskId: ROAM_ALPACA_TASK_IDS.PT },
} as const satisfies Record<string, RoamLanguageEntry<RoamAlpacaId>>;

/**
 * Derives a task ID from the task family and i18next language code.
 *
 * `initConfig.js` carries `taskName` (one of the base/English task IDs —
 * 'fluency-arf', 'fluency-calf', 'roam-alpaca' — the same strings `scores.js`
 * branches on) and `language` (from `i18next.language`) separately, not a
 * resolved taskId. This maps the pair to the correct backend task ID, mirroring
 * `resolveTaskId` in roar-letter/variants.ts.
 *
 * Language lookup is case-insensitive. An unrecognized language falls back to
 * the English (base) task ID for whichever family was recognized; an
 * unrecognized task family falls back to `taskName` itself.
 *
 * @param taskName - Base task ID from variant params (e.g. 'fluency-arf', 'roam-alpaca')
 * @param language - i18next language code (e.g. 'en', 'es', 'pt')
 * @returns The resolved task ID
 */
export function resolveRoamTaskId(taskName: string, language: string): string {
  const code = language.toLowerCase();

  if (taskName === ROAM_FLUENCY_ARF_TASK_IDS.EN) {
    return (
      ROAM_FLUENCY_ARF_LANGUAGES[code as keyof typeof ROAM_FLUENCY_ARF_LANGUAGES]?.taskId ??
      ROAM_FLUENCY_ARF_TASK_IDS.EN
    );
  }
  if (taskName === ROAM_FLUENCY_CALF_TASK_IDS.EN) {
    return (
      ROAM_FLUENCY_CALF_LANGUAGES[code as keyof typeof ROAM_FLUENCY_CALF_LANGUAGES]?.taskId ??
      ROAM_FLUENCY_CALF_TASK_IDS.EN
    );
  }
  if (taskName === ROAM_ALPACA_TASK_IDS.EN) {
    return ROAM_ALPACA_LANGUAGES[code as keyof typeof ROAM_ALPACA_LANGUAGES]?.taskId ?? ROAM_ALPACA_TASK_IDS.EN;
  }

  return taskName;
}
