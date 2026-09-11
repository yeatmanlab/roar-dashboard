// @ts-check
import jsPsychFullScreen from '@jspsych/plugin-fullscreen';
import fscreen from 'fscreen';
import i18next from 'i18next';
import '../i18n';

let first = true;
const sentryFeedback = document.querySelector('#sentry-feedback');

const fullScreenTrial = {
  type: jsPsychFullScreen,
  fullscreen_mode: true,
  message: () => `<div class='text_div'><h1>${i18next.t('fullScreenTrial.prompt')}</h1></div>`,
  delay_after: 0,
  button_label: () => `${i18next.t('fullScreenTrial.buttonText')}`,
  on_start: () => {
    document.body.style.cursor = 'default';
    // Hide sentry feedback button
    if (sentryFeedback) {
      sentryFeedback.style.display = 'none';
    }
  },
  on_finish: () => {
    if (!first) {
      document.body.style.cursor = 'none';
      return;
    }
    first = false;
  },
};

export const enterFullscreen = fullScreenTrial;

export const ifNotFullscreen = {
  timeline: [enterFullscreen],
  conditional_function: () => fscreen.fullscreenElement === null,
};

export const exitFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: false,
  delay_after: 0,
};
