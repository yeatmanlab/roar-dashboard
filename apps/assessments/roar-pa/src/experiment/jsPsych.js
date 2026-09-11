import { initJsPsych } from 'jspsych';
import i18next from 'i18next';
import './i18n';

let isUpdated = false;

export const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  message_progress_bar: `${i18next.t('progressBar')}`,
  on_finish: () => {
    document.body.style.cursor = 'auto';
  },
  on_trial_start: () => {
    if (!isUpdated) {
      const progressBarEl = document.querySelector('#jspsych-progressbar-container > span');
      progressBarEl.textContent = `${i18next.t('progressBar')}`;
      isUpdated = true;
    }
  },
});
