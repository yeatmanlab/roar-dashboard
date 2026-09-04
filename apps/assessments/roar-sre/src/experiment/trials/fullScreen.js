import jsPsychFullScreen from '@jspsych/plugin-fullscreen';
import i18next from 'i18next';
import '../i18n';

let first = true;
const sentryFeedback = document.querySelector('#sentry-feedback');

export const enterFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: true,
  message: () => `<div class='text_div'><h1>${i18next.t('fullScreenTrial.prompt')}</h1></div>`,
  css_classes: ['jspsych-content-modified'],
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
