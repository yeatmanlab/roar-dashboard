import { initCompBlock } from './symCompBlock';
import { updateStimulus } from '../../shared/helpers';
import { symComp, practiceFeedbackIncorrect, practiceFeedbackCorrect } from './symComp';
import store from 'store2';

const ifIncorrect = (corpusName, assessment_stage_val) => {
  return {
    timeline: [practiceFeedbackIncorrect(corpusName, assessment_stage_val)],
    on_timeline_start: () => {
      store.session.transact('indexTracking', (oldVal) => oldVal + 1);
    },
    conditional_function: () => {
      if (store.session.get('dataCorrect') === 0) {
        return true;
      }
      return false;
    },
  };
};

const ifCorrect = () => {
  return {
    timeline: [practiceFeedbackCorrect],
    conditional_function: () => {
      if (store.session.get('dataCorrect') === 0) {
        return false;
      }
      return true;
    },
  };
};

const practiceFeedback = (corpusName, assessment_stage_val) => {
  return {
    timeline: [ifCorrect(), ifIncorrect(corpusName, assessment_stage_val)],
  };
};

export const symPracticeLoop = (corpusName, assessment_stage_val, taskType) => {
  return {
    timeline: [
      initCompBlock(corpusName, taskType),
      updateStimulus(corpusName),
      symComp(assessment_stage_val),
      practiceFeedback(corpusName, assessment_stage_val),
    ],
    loop_function: function () {
      if (store.session.get('currentCorpus').length === 0) {
        store.session.set('indexTracking', -1);
        return false;
      }
      return true;
    },
  };
};
