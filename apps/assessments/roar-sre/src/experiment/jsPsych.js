import { initJsPsych } from 'jspsych';
import i18next from 'i18next';
import './i18n';
import store from 'store2';

const redirectInfo = {
  demo: 'https://roar.stanford.edu/',
};

export const jsPsych = initJsPsych({
  show_progress_bar: false,
  auto_update_progress_bar: false,
  message_progress_bar: `${i18next.t('progressBar')}`,
  on_finish: () => {
    document.body.style.cursor = 'auto';
    const config = store.session.get('config');

    if (config.recruitment === 'demo') {
      window.location.href = redirectInfo.demo;
    }
  },
});
