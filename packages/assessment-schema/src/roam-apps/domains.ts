/**
 * Subtask domain names emitted by RoarScores.computedScoreCallback for ROAM apps.
 */

/**
 * Used for recruitment=responseModality. Only FC and FR are reported on the frontend.
 * FC = forced/multiple choice (AFC trials); FR = free response (production trials).
 */
export const ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS = {
  MULTIPLE_CHOICE: 'FC',
  FREE_RESPONSE: 'FR',
  RT_CONTROL_2AFC: 'rtControl_2afc',
  RT_CONTROL_6AFC: 'rtControl_6afc',
  RT_CONTROL_PRODUCTION: 'rtControl_production',
} as const;

/**
 * Subtasks below do not have scores for assessmentStage=PRACTICE
 *
 * symbolicComp is for fluency-arf recruitment=magpiPilot
 * It only contains the base subtask score names.
 */
export const ROAM_FLUENCY_SUBTASK_DOMAINS = {
  ADDITION: 'addition',
  DIVISION: 'division',
  MULTIPLICATION: 'multiplication',
  SUBTRACTION: 'subtraction',
  SYMBOLIC_COMP: 'symbolicComp',
} as const;

export type RoamFluencySubtaskDomain = (typeof ROAM_FLUENCY_SUBTASK_DOMAINS)[keyof typeof ROAM_FLUENCY_SUBTASK_DOMAINS];

/**
 * Subtasks below do not have scores for assessmentStage=PRACTICE
 *
 * numberLine is for recruitment=magpiPilot
 * It only contains the base subtask score names.
 */
export const ROAM_ALPACA_SUBTASK_DOMAINS = {
  NUMBER_KNOWLEDGE: 'numberKnowledge',
  GEOMETRY: 'geometry',
  ARITHMETIC_EXPRESSIONS: 'arithmeticExpressions',
  RATIONAL_NUMBERS_PROBABILITY: 'rationalNumbersProbability',
  ALGEBRAIC_THINKING: 'algebraicThinking',
  NUMBER_LINE: 'numberLine',
} as const;

export type RoamAlpacaSubtaskDomain = (typeof ROAM_ALPACA_SUBTASK_DOMAINS)[keyof typeof ROAM_ALPACA_SUBTASK_DOMAINS];
