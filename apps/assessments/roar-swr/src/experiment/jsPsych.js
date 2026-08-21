import { initJsPsych } from 'jspsych';
import i18next from 'i18next';
import './i18n';
import store from 'store2';

const redirectInfo = {
  prolific: 'https://app.prolific.com/submissions/complete?cc=CKD7AVY5',
  demo: 'https://roar.stanford.edu/',
};

let isUpdated = false;

export const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  message_progress_bar: `${i18next.t('progressBar')}`,
  on_finish: () => {
    document.body.style.cursor = 'auto';
    const config = store.session.get('config');
    if (config.recruitment === 'demo') {
      window.location.href = redirectInfo.demo;
    }
    if (config.recruitment === 'prolific') {
      window.location.href = redirectInfo.prolific;
    }
    if (config.recruitment === 'sona') {
      window.location.href = `https://stanfordpsych.sona-systems.com/webstudy_credit.aspx?experiment_id=785&credit_token=3aecfa1b1c5943ecb1f68f54b75f3404&survey_code=${
        store.session.get('config').pid
      }`;
    }
  },
  on_trial_start: () => {
    if (!isUpdated) {
      const progressBarEl = document.querySelector('#jspsych-progressbar-container > span');
      progressBarEl.textContent = `${i18next.t('progressBar')}`;
      isUpdated = true;
    }
  },
});
