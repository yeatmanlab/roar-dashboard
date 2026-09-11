import { fractionInstructionDesktop } from './fractionInstructionDesktop';
import { fractionInstructionMobile } from './fractionInstructionMobile';
import { isMobile } from './trialHelpers';

export const fractionInstruction = (corpusName, assessment_stage_val) => {
  let timelineObj = [fractionInstructionDesktop(corpusName, assessment_stage_val)];

  if (isMobile) {
    timelineObj = [fractionInstructionMobile(corpusName, assessment_stage_val)];
  }

  return {
    timeline: timelineObj,
  };
};
