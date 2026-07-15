const ROAM_BASE_SUBTASK_SCORE_NAMES = {
  NUM_ATTEMPTED: 'numAttempted',
  NUM_CORRECT: 'numCorrect',
  NUM_INCORRECT: 'numIncorrect',
  RAW_SCORE: 'rawScore',
} as const;

export const ROAM_FLUENCY_SUBTASK_SCORE_NAMES = {
  ...ROAM_BASE_SUBTASK_SCORE_NAMES,
  SKILLS_ASSESSED: 'skillsAssessed',
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
} as const;

export type RoamFluencySubtaskScoreName =
  (typeof ROAM_FLUENCY_SUBTASK_SCORE_NAMES)[keyof typeof ROAM_FLUENCY_SUBTASK_SCORE_NAMES];

export const ROAM_FLUENCY_RAW_SUBTASK_SCORE_NAMES = new Set<RoamFluencySubtaskScoreName>([
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_CORRECT,
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
]);

export const ROAM_FLUENCY_COMPOSITE_SCORE_NAMES = {
  ...ROAM_BASE_SUBTASK_SCORE_NAMES,
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
} as const;

export type RoamFluencyCompositeScoreName =
  (typeof ROAM_FLUENCY_COMPOSITE_SCORE_NAMES)[keyof typeof ROAM_FLUENCY_COMPOSITE_SCORE_NAMES];

export const ROAM_FLUENCY_RAW_COMPOSITE_SCORE_NAMES = new Set<RoamFluencyCompositeScoreName>([
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
]);

export const ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES = {
  ADDITION_INCORRECT_SKILLS: 'additionIncorrectSkills',
  DIVISION_INCORRECT_SKILLS: 'divisionIncorrectSkills',
  MULTIPLICATION_INCORRECT_SKILLS: 'multiplicationIncorrectSkills',
  SUBTRACTION_INCORRECT_SKILLS: 'subtractionIncorrectSkills',
} as const;

export type RoamFluencyIncorrectSkillsScoreName =
  (typeof ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES)[keyof typeof ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES];

export type RoamFluencyScoreName =
  | RoamFluencySubtaskScoreName
  | RoamFluencyCompositeScoreName
  | RoamFluencyIncorrectSkillsScoreName;

export const ROAM_ALPACA_SUBTASK_SCORE_NAMES = {
  ...ROAM_BASE_SUBTASK_SCORE_NAMES,
  GRADE_ESTIMATE: 'gradeEstimate',
  SUB_PERCENT_CORRECT: 'subPercentCorrect',
  SUPPORT_LEVEL: 'supportLevel',
} as const;

export type RoamAlpacaSubtaskScoreName =
  (typeof ROAM_ALPACA_SUBTASK_SCORE_NAMES)[keyof typeof ROAM_ALPACA_SUBTASK_SCORE_NAMES];

export const ROAM_ALPACA_RAW_SUBTASK_SCORE_NAMES = new Set<RoamAlpacaSubtaskScoreName>([
  ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_CORRECT,
  ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
  ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
]);

export const ROAM_ALPACA_COMPOSITE_SCORE_NAMES = {
  ...ROAM_BASE_SUBTASK_SCORE_NAMES,
  GRADE_ESTIMATE: 'gradeEstimate',
  INCORRECT_SKILLS: 'incorrectSkills',
  ROAR_SCORE: 'roarScore',
  SUPPORT_LEVEL: 'supportLevel',
  THETA_ESTIMATE: 'thetaEstimate',
  THETA_ESTIMATE_RAW: 'thetaEstimateRaw',
} as const;

export type RoamAlpacaCompositeScoreName =
  (typeof ROAM_ALPACA_COMPOSITE_SCORE_NAMES)[keyof typeof ROAM_ALPACA_COMPOSITE_SCORE_NAMES];

export const ROAM_ALPACA_RAW_COMPOSITE_SCORE_NAMES = new Set<RoamAlpacaCompositeScoreName>([
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW,
]);

export type RoamAlpacaScoreName = RoamAlpacaSubtaskScoreName | RoamAlpacaCompositeScoreName;
