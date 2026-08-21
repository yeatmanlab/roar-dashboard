import { initJsPsych } from 'jspsych';
import '../../../i18n/i18n'; // get i18next class as defined in i18n.js to get the text for progress bar
import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

const redirectInfo = {
  cdm: 'https://stanford-cogsci.org:8880/landing_page.html',
  demo: 'https://roar.stanford.edu/',
};

export const jsPsych = initJsPsych({
  on_finish: () => {
    document.body.style.cursor = 'auto';
    const config = sessionGet(SK.CONFIG);
    if (config.recruitment === 'cdm') {
      window.location.href = redirectInfo.cdm;
    }
    if (config.recruitment === 'demo') {
      window.location.href = redirectInfo.demo;
    }
  },
});
