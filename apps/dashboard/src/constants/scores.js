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
export const SCORE_SUPPORT_LEVEL_COLORS = Object.freeze({
  BELOW: '#c93d82', // pink
  ABOVE: '#008000', // green according to CSS Color Module Level 4.
  SOME: '#edc037', // yellow
  ASSESSED: '#3b82f6', // blue-500
  OPTIONAL: '#71717a', // gray-500
  UNRELIABLE: '#d6b8c7', // pink-200
});
