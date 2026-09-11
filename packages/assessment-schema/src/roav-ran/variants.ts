import { RAN_TASK_ID, SYMBOL_SEARCH_TASK_ID } from './config.js';
import type { RoavRanTaskId } from './config.js';

type RoavRanTaskEntry = {
  taskId: RoavRanTaskId;
  name: string;
  nameSimple: string;
  nameTechnical: string;
};

export const RAN_TASK = {
  taskId: RAN_TASK_ID,
  name: 'Rapid Automatized Naming',
  nameSimple: 'RAN',
  nameTechnical: 'ROAR - Rapid Automatized Naming',
} as const satisfies RoavRanTaskEntry;

export const SYMBOL_SEARCH_TASK = {
  taskId: SYMBOL_SEARCH_TASK_ID,
  name: 'Symbol Search',
  nameSimple: 'Symbol Search',
  nameTechnical: 'ROAR - Symbol Search',
} as const satisfies RoavRanTaskEntry;

/**
 * Canonical task entries for roav-ran (English only). The backend seed creates one task per
 * entry (plus its variants, read from taskVariantParameters.json). Adding a non-English
 * language would add language-suffixed entries here (e.g. `ran-es`) — see the plan's
 * language audit.
 */
export const ROAV_RAN_TASKS = [RAN_TASK, SYMBOL_SEARCH_TASK] as const;
