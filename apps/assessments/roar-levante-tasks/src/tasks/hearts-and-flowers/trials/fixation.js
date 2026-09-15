import jsPsychHTMLMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { StimulusSideType, InputKey } from '../helpers/utils';
import {
  addExperimenterButtons,
  addKeyHelpers,
  getParticipantUtilityButtonsHtml,
  setupFullscreenButton,
} from '../../shared/helpers';
import { setupHafMultiResponseTouchRouting } from '../helpers/touchResponseRouting';
import { taskStore } from '../../../taskStore';

export function fixation(interStimulusInterval) {
  const hfV2 = taskStore().version === 2;
  return {
    type: jsPsychHTMLMultiResponse,
    stimulus: () => {
      return `<div class='haf-fixation-container'>
                <span class='fixation'>+</span>
              </div>
              ${getParticipantUtilityButtonsHtml('replay-btn-revisited', false)}
              `;
    },
    on_load: () => {
      // document.getElementById('jspsych-html-multi-response-btngroup').classList.add('btn-layout-hf');
      document.getElementById('jspsych-html-multi-response-stimulus').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('lev-response-row');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('linear-4');

      const responseButtons = document.querySelectorAll('.jspsych-html-multi-response-button');
      responseButtons.forEach((button, i) => {
        addKeyHelpers(button, i);
      });

      if (hfV2) {
        setupHafMultiResponseTouchRouting();
      }

      addExperimenterButtons();
      setupFullscreenButton();
    },
    button_choices: [StimulusSideType.Left, StimulusSideType.Right],
    keyboard_choices: InputKey.NoKeys,
    button_html: [
      `
    <div class='response-container--small'>
      <button class='secondary--green'></button>
    </div>`,
      `<div class='response-container--small'>
      <button class='secondary--green'></button>
    </div>`,
    ],
    trial_duration: interStimulusInterval,
    response_ends_trial: false,
  };
}
