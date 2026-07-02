import { jsPsych } from '../../taskSetup';
import { finishExperiment } from '../trials/finishExperiment';

const exemptTrialTypes = ['something-same-1'];
const eligibleAssessmentStages = [
  'test_response',
  'first_response',
  'second_response',
  'third_response',
  'fourth_response',
];

// ends the task if 4 of the last 10 trials have been incorrect
export function shouldTerminateCat() {
  const data = jsPsych.data.get().filterCustom((trial: any) => {
    return (
      !exemptTrialTypes.includes(trial.corpusTrialType) && eligibleAssessmentStages.includes(trial.assessment_stage)
    );
  });
  const lastTenTrials = data.last(10);
  const incorrectTrials = lastTenTrials.filter({ correct: false });
  const terminate = incorrectTrials.count() > 6;

  if (terminate) {
    finishExperiment();
  }
}
