export const SCORE_TYPES = {
  rawScore: {
    key: 'rawScore',
    label: 'Raw Score',
    priority: 1,
  },
  percentile: {
    key: 'percentile',
    label: 'Percentile',
    priority: 2,
  },
  standardScore: {
    key: 'standardScore',
    label: 'Standard Score',
    priority: 3,
  },
} as const;

export type ScoreType = keyof typeof SCORE_TYPES;
