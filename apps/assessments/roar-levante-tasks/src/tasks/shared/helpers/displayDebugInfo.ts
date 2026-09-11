import { taskStore } from '../../../taskStore';
import { jsPsych, cat } from '../../taskSetup';

function isRealTrial(trial: any) {
  return (
    trial.assessment_stage &&
    trial.assessment_stage !== 'practice_response' &&
    trial.assessment_stage !== 'instructions'
  );
}

export function displayDebugInfo(stim: StimulusType) {
  if (taskStore().debug && taskStore().runCat) {
    const lastRealTrial = jsPsych.data.get().filterCustom(isRealTrial).last().values()[0];
    const thetaEstimate = cat.theta;
    const currentTrialDifficulty = stim.difficulty;
    const CurrentTrialUid = stim.itemUid;

    let previousResponse = 'N/A';
    if (lastRealTrial?.correct !== undefined) {
      previousResponse = lastRealTrial.correct ? 'Correct' : 'Incorrect';
    }

    const thetaEstimateContainer = document.createElement('div');
    thetaEstimateContainer.classList.add('theta-estimate-container');
    thetaEstimateContainer.innerHTML = `
          <p>Theta estimate: ${thetaEstimate}</p>
          <p>Previous response: ${previousResponse}</p>
          <p>Current trial difficulty: ${currentTrialDifficulty}</p>
          <p>Current trial UID: ${CurrentTrialUid}</p>
        `;
    document.body.appendChild(thetaEstimateContainer);
  }
}
