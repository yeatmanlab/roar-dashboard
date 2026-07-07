import { READALOUD_TASK_ID } from './config.js';
import type { ReadaloudTaskId } from './config.js';

type ReadaloudTaskEntry = {
  taskId: ReadaloudTaskId;
  name: string;
  nameSimple: string;
  nameTechnical: string;
};

/**
 * Canonical task entry for read-aloud. Read-aloud is a single English task, so there is
 * exactly one entry; the backend seed creates one task (plus its variants) from it.
 *
 * NOTE: the display names below are placeholders — confirm the official task names.
 */
export const READALOUD_TASK = {
  taskId: READALOUD_TASK_ID,
  name: 'Read Aloud',
  nameSimple: 'Read Aloud',
  nameTechnical: 'Rapid Online Assessment of Reading — Read Aloud',
} as const satisfies ReadaloudTaskEntry;
