export const PA_TASK_ID = "pa" as const;

export const PA_DEV_PORT = 8000 as const;

export const PA_SCORING_VERSION = {
  FIXED: 3,
  ADAPTIVE: 4,
} as const;

export type PaScoringVersion =
  (typeof PA_SCORING_VERSION)[keyof typeof PA_SCORING_VERSION];

export const PA_SCORE_KIND = {
  FIXED: "raw_total_correct",
  ADAPTIVE: "scaled_irt",
} as const;

export type PaScoreKind = (typeof PA_SCORE_KIND)[keyof typeof PA_SCORE_KIND];

export const PA_SUBTASK_KEYS = ["FSM", "LSM", "DEL"] as const;

export type PaSubtaskKey = (typeof PA_SUBTASK_KEYS)[number];

// Currently only used by the PA scoring service, but may be used by other services in the future
export const PA_SCORE_TABLE_URL = (version: PaScoringVersion): string =>
  `https://storage.googleapis.com/roar-pa/scores/pa_lookup_v${version}.csv`;
