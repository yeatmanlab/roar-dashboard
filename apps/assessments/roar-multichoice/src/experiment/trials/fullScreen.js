// @ts-check
import jsPsychFullScreen from '@jspsych/plugin-fullscreen';
import fscreen from 'fscreen';
import i18next from 'i18next';

import '../i18n';

const sentryFeedback = document.querySelector('#sentry-feedback');

const fullScreenTrialData = [
  {
    onFinish: () => {
      // document.body.style.cursor = "none";
    },
  },
  {
    onFinish: () => {
      // document.body.style.cursor = "none";
    },
  },
];

const fullScreenTrials = fullScreenTrialData.map((trial) => ({
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
    if (sentryFeedback) {
      sentryFeedback.style.display = 'none';
    }
  },
  on_finish: trial.onFinish,
}));

export const enterFullscreen = fullScreenTrials[0];
const reenterFullscreen = fullScreenTrials[1];

export const ifNotFullscreen = {
  timeline: [reenterFullscreen],
  conditional_function: () => fscreen.fullscreenElement === null,
};

export const exitFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: false,
  delay_after: 0,
};
