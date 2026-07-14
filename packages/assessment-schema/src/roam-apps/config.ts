/**
 * ROAM task IDs — one per supported language. Mirrors SWR_TASK_IDS / SRE_TASK_IDS.
 * The `lng` URL param selects the language; `serve.js` uses LETTER_LANGUAGES to
 * translate that into the correct task ID for bootstrapAnonymousSession.
 */
export const ROAM_FLUENCY_ARF_TASK_IDS = {
  EN: 'fluency-arf',
  ES: 'fluency-arf-es',
  PT: 'fluency-arf-pt',
} as const;

export type RoamFluencyArfId = (typeof ROAM_FLUENCY_ARF_TASK_IDS)[keyof typeof ROAM_FLUENCY_ARF_TASK_IDS];

export const ROAM_FLUENCY_CALF_TASK_IDS = {
  EN: 'fluency-calf',
  ES: 'fluency-calf-es',
  PT: 'fluency-calf-pt',
} as const;

export type RoamFluencyCalfId = (typeof ROAM_FLUENCY_CALF_TASK_IDS)[keyof typeof ROAM_FLUENCY_CALF_TASK_IDS];


export const ROAM_ALPACA_TASK_IDS = {
  EN: 'roam-alpaca',
  ES: 'roam-alpaca-es',
  PT: 'roam-alpaca-pt',
} as const;

export type RoamAlpacaId = (typeof ROAM_ALPACA_TASK_IDS)[keyof typeof ROAM_ALPACA_TASK_IDS];
