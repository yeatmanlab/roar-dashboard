import jsPsychHTMLMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';
import { finishExperiment } from './finishExperiment';

const t = taskStore().translations;
const buttonText = ['dataQuestionnaireButtonText1', 'dataQuestionnaireButtonText2', 'dataQuestionnaireButtonText3'];

export const dataQualityScreen = {
  type: jsPsychHTMLMultiResponse,
  data: () => {
    return {
      // save_trial: true,
      assessment_stage: 'assessor_questionaire',
    };
  },
  stimulus: `<div class="lev-row-container header">
        <p>Assessor Data Questionnaire</p>
      </div>
      <div class="lev-row-container instruction">
        <p>How would you rate the quality of the data for this task?</p>
      </div>
      <footer style="text-align: center; margin: 20px 0;">
        Note: This is NOT a question about how well the child performed. Instead, we want your impression of how well the child understood and actively participated in the task.
      </footer>`,
  keyboard_choices: 'NO_KEYS',
  button_choices: () => buttonText,
  button_html: () => {
    const t = taskStore().translations;
    return buttonText.map((text) => `<button class="primary" style="font-size: 16px">${t[text]}</button>`);
  },
  on_load: () => {
    const jsPsychContent = document.getElementsByClassName('jspsych-content')[0];
    jsPsychContent.setAttribute('style', 'width: 80vw; max-width: 800px; padding: 20px; background-color: white');

    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
    buttonContainer.classList.add('lev-response-row', 'multi-stack');
  },
  on_finish: (data: any) => {
    let dataQuality: string = '';
    if (data.button_response === 0) {
      dataQuality = 'SERIOUS CONCERNS';
    } else if (data.button_response === 1) {
      dataQuality = 'OK';
    } else if (data.button_response === 2) {
      dataQuality = 'GOOD';
    }

    jsPsych.data.addDataToLastTrial({
      dataQuality: dataQuality,
    });

    const jsPsychContent = document.getElementsByClassName('jspsych-content')[0];
    jsPsychContent.setAttribute('style', ''); // remove styling from jspsych-content for next trial
    finishExperiment();
  },
};
