/**
 * Assessment Stage Enum
 *
 * Enumerates the available assessment stages.
 */
import { assessmentStageEnum } from '../db/schema/enums';
import { pgEnumToConst } from './utils';

export const AssessmentStage = pgEnumToConst(assessmentStageEnum);

export type AssessmentStage = (typeof assessmentStageEnum.enumValues)[number];
