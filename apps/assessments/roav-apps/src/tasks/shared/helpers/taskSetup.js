import { initJsPsych } from 'jspsych';
import '../../../i18n/i18n'; // get i18next class as defined in i18n.js to get the text for progress bar
import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';
import { DURATIONS, RATE_AUDIO_LOW } from './constants';

const redirectInfo = {
  cdm: 'https://stanford-cogsci.org:8880/landing_page.html',
  demo: 'https://roar.stanford.edu/',
};

// @fix-freeze-audio - begin

// eslint-disable-next-line no-unused-vars
const isIPadSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIPad = /iPad/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  return isIPad && isSafari;
};
// @fix-freeze-audio - end

// DO NOT REMOVE - for easy testing of HTML audio
// const useHtmlAudio = new URLSearchParams(window.location.search).has(
//   "audio-html",
// );

export const jsPsych = initJsPsych({
  use_webaudio: true,
  // DO NOT REMOVE - for easy testing of HTML audio
  // use_webaudio: !(useHtmlAudio && isIPadSafari()), // @fix-freeze-audio
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

// @fix-freeze-audio — begin

// closing context before unload (Safari might leak it across reload)
window.addEventListener('beforeunload', () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  try {
    ctx?.suspend?.();
  } catch (_) {
    /* empty */
  }
  if (ctx) ctx.close().catch(() => {});
});

// resume AudioContext at every trial start (iPad Safari warm start)
jsPsych.opts.on_trial_start = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  if (!ctx) return;

  ctx.resume().catch(() => {});
  setTimeout(() => {
    ctx.resume().catch(() => {});
  }, DURATIONS.AUDIO_CONTEXT_RESUME_RETRY_LONG);
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate || RATE_AUDIO_LOW);
    src.connect(ctx.destination);
    src.start(0);
  } catch (_) {
    /* empty */
  }
};

// @fix-freeze-audio - end
