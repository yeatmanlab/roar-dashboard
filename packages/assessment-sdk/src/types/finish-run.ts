export const RUN_EVENT_COMPLETE = 'complete' as const;

import type { Json } from '@roar-dashboard/api-contract';

export interface FinishRunInput {
  runId: string;
  type: typeof RUN_EVENT_COMPLETE;
  metadata?: Json;
}

export type FinishRunOutput = Record<string, never>;
