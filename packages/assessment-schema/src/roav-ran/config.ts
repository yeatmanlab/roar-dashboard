/**
 * Canonical task IDs for roav-ran (Rapid Automatized Naming + Symbol Search).
 *
 * roav-ran is English-only today (see the migration plan's language audit): the i18next
 * layer registers only `en`. Non-English support would follow the language-as-taskId model
 * (like roar-swr/sre/letter) by adding language-suffixed task IDs (e.g. `ran-es`) — not a
 * per-variant language param. Neither task writes computed scores (RAN scoring is trial-based
 * and its autoscoring runs offline), so there is no scoring config here.
 */
export const RAN_TASK_ID = 'ran' as const;
export type RanTaskId = typeof RAN_TASK_ID;

// Kebab-case: the DB `tasks.slug` check constraint requires `^[a-z0-9]+(-[a-z0-9]+)*$`.
// The assessment routes tasks via `taskConfig[camelize(taskName)]`, and `camelize('symbol-search')`
// yields `symbolSearch`, matching the taskConfig key — so the slug is kebab while the code stays camel.
export const SYMBOL_SEARCH_TASK_ID = 'symbol-search' as const;
export type SymbolSearchTaskId = typeof SYMBOL_SEARCH_TASK_ID;

export type RoavRanTaskId = RanTaskId | SymbolSearchTaskId;
