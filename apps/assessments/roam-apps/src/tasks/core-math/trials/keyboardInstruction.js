import { keyboardInstructionDesktop } from './keyboardInstructionDesktop';
import { keyboardInstructionMobile } from './keyboardInstructionMobile';
import { isMobile } from './trialHelpers';

export const keyboardInstruction = (corpusName, assessment_stage_val) => {
  let timelineObj = [keyboardInstructionDesktop(corpusName, assessment_stage_val)];

  if (isMobile) {
    timelineObj = [keyboardInstructionMobile(corpusName, assessment_stage_val)];
  }

  return {
    timeline: timelineObj,
  };
};
