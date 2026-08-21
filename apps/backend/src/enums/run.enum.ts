import { assessmentStageEnum, trialInteractionTypeEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const AssessmentStage = pgEnumToConst(assessmentStageEnum);
export const TrialInteractionType = pgEnumToConst(trialInteractionTypeEnum);

export type AssessmentStage = (typeof assessmentStageEnum.enumValues)[number];
export type TrialInteractionType = (typeof trialInteractionTypeEnum.enumValues)[number];
