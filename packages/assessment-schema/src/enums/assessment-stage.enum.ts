/**
 * Assessment stage enum for score entries and trial events.
 *
 * Values match api-contract's AssessmentStageSchema and the backend
 * run_scores.assessment_stage column. Defined here as the canonical source
 * for the assessment-schema package — assessment-sdk mirrors them independently
 * to avoid a circular dependency.
 */
export enum AssessmentStage {
  PRACTICE = 'practice',
  TEST = 'test',
}
