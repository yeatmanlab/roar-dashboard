import {
  numberMainTimerDesktop,
  practiceFeedbackIncorrectDesktop,
  practiceFeedbackCorrectDesktop,
} from './trialProductionDesktop';
import {
  numberMainTimerMobile,
  practiceFeedbackIncorrectMobile,
  practiceFeedbackCorrectMobile,
} from './trialProductionMobile';
import { isMobile } from '../helpers';

export const numberMainTimer = (corpusName, assessment_stage_val) => {
  let timelineObj = [numberMainTimerDesktop(corpusName, assessment_stage_val)];

  if (isMobile) {
    timelineObj = [numberMainTimerMobile(corpusName, assessment_stage_val)];
  }

  return {
    timeline: timelineObj,
  };
};

export const practiceFeedbackIncorrect = (corpusName, assessment_stage_val) => {
  let timelineObj = [practiceFeedbackIncorrectDesktop(corpusName, assessment_stage_val)];

  if (isMobile) {
    timelineObj = [practiceFeedbackIncorrectMobile(corpusName, assessment_stage_val)];
  }

  return {
    timeline: timelineObj,
  };
};

export const practiceFeedbackCorrect = () => {
  let timelineObj = [practiceFeedbackCorrectDesktop];

  if (isMobile) {
    timelineObj = [practiceFeedbackCorrectMobile];
  }

  return {
    timeline: timelineObj,
  };
};
