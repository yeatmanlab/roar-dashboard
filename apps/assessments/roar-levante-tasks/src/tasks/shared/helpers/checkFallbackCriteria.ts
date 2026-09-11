import { taskStore } from '../../../taskStore';
import { jsPsych } from '../../taskSetup';
import { isLanguageAllowedDownex } from './checkLocale';

export const checkFallbackCriteria = (filterInputTrials: boolean = false) => {
  const data = jsPsych.data.get().filter({ assessment_stage: 'test_response' }).last(4);

  let incorrectTrials = data.filter({ correct: false });
  if (filterInputTrials) {
    incorrectTrials = incorrectTrials.filter({ trialMode: 'input' });
  }

  const numIncorrect = incorrectTrials.count();
  return numIncorrect >= 2 && isLanguageAllowedDownex(taskStore().language);
};
