export const SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH = '/docs/roar-next-steps.pdf';

export const SCORE_TYPES = Object.freeze({
  STANDARD_SCORE: 'standardScore',
  RAW_SCORE: 'rawScore',
  PERCENTILE_SCORE: 'percentileScore',
});

export const SCORE_SUPPORT_SKILL_LEVELS = Object.freeze({
  ACHIEVED_SKILL: 'Achieved Skill',
  DEVELOPING_SKILL: 'Developing Skill',
  NEEDS_EXTRA_SUPPORT: 'Needs Extra Support',
});

/**
 * Colors used for different support levels in score visualizations
 */
export const supportLevelColors = Object.freeze({
  above: '#22c55e', // green-500
  Green: '#22c55e', // green-500
  some: '#edc037', // yellow
  Yellow: '#edc037', // yellow
  below: '#c93d82', // pink
  Pink: '#c93d82', // pink
  optional: '#71717a', // gray-500
  Optional: '#71717a', // gray-500
  Assessed: '#3b82f6', // blue-500
  Unreliable: '#d6b8c7', // pink-200
});
