export const SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH = '/docs/roar-next-steps.pdf';

// Score type keys for backward compatibility
export const SCORE_TYPE_KEYS = Object.freeze({
  STANDARD_SCORE: 'standardScore',
  RAW_SCORE: 'rawScore',
  PERCENTILE_SCORE: 'percentileScore',
});

// Score types with metadata for charts and displays
export const SCORE_TYPES = Object.freeze({
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
});

export const SCORE_SUPPORT_SKILL_LEVELS = Object.freeze({
  ACHIEVED_SKILL: 'Achieved Skill',
  DEVELOPING_SKILL: 'Developing Skill',
  NEEDS_EXTRA_SUPPORT: 'Needs Extra Support',
});
