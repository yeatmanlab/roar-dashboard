import { AssessmentStage } from '../enums/assessment-stage.enum.js';
import { ScoreType } from '../enums/score-type.enum.js';

/**
 * Score entry constraint for run_scores entries.
 * Defines the structure of a score entry constraint, which includes the type of score, domain, name, value, assessment stage, and optional category score.
 */
export type ScoreEntryConstraint = {
  type: ScoreType;
  domain: string;
  name: string;
  value: string;
  assessmentStage: AssessmentStage;
  categoryScore?: boolean;
};
