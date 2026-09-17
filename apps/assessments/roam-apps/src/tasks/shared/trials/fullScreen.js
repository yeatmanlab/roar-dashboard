/*
Functions which define jspsych objects for going into full screen and exiting full screen mode.
*/

// @ts-check
import jsPsychFullScreen from '@jspsych/plugin-fullscreen'; //plugin for going into fullscreen
//import fscreen from "fscreen"; //for checking the state of full screen mode
import i18next from 'i18next'; //for converting displayed text into required language
import '../../../i18n/i18n'; //doesn't seem to be required here

const sentryFeedback = document.querySelector('#sentry-feedback');

//jspsych object for going into full screen
export const enterFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: true,
  message: () =>
    `<div id='fullScreen'>
      <h1>${i18next.t('fullScreenTrial.prompt')}</h1>
     </div>`,
  delay_after: 0,
  button_label: () => `${i18next.t('fullScreenTrial.buttonText')}`,
  on_start: () => {
    document.body.style.cursor = 'default';
    // Hide sentry feedback button
    if (sentryFeedback) {
      sentryFeedback.style.display = 'none';
    }
  },
  on_load: () => {
    // @ts-ignore: Object is possibly 'null'.
    let el = document.getElementById('jspsych-progressbar-container');
    if (el) {
      el.style.visibility = 'hidden';
    }
  },
};

//exits full screen
export const exitFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: false,
  delay_after: 0,
};
