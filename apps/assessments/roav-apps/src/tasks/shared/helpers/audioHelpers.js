import jsPsychCallFunction from '@jspsych/plugin-call-function';
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import i18next from 'i18next';
import { mediaAssets } from './mediaAssets';
import { jsPsych } from './taskSetup';
import { wrapAsJsPsychTrial } from './jspsychHelpers';
import { DURATIONS, RATE_AUDIO_LOW } from './constants';

export const stopAudioPlugin = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  try {
    ctx?.suspend?.();
  } catch (_) {
    /* empty */
  }
};

const playSilentBuffer = (ctx) => {
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate || RATE_AUDIO_LOW);
    src.connect(ctx.destination);
    src.start(0);
  } catch (_) {
    /* empty */
  }
};

export const createHelperAudioCustom = () => {
  let assetAudio = null;
  let srcAudio = null;
  let bufferAudio = null;
  let durationAudio = 0;

  const setAssetAudio = (assetAudioIn) => {
    assetAudio = assetAudioIn ?? mediaAssets.audio.roavMpNullAudioAll;
  };

  const stopAudioCustom = () => {
    // stop main trial audio
    try {
      srcAudio?.stop?.(0);
    } catch (_) {
      /* empty */
    }
    try {
      srcAudio?.disconnect?.();
    } catch (_) {
      /* empty */
    }
    try {
      srcAudio?.pause?.();
      srcAudio.currentTime = 0;
    } catch (_) {
      /* empty */
    }
  };

  const stopAndClearAudioCustom = () => {
    stopAudioCustom();
    srcAudio = null;
    bufferAudio = null;
  };

  const startAudioCustom = () => {
    stopAudioCustom();
    // dual path for WebKit
    if (bufferAudio) {
      const ctxAudio = jsPsych.pluginAPI.audioContext();

      if (ctxAudio && typeof ctxAudio.createBufferSource === 'function') {
        srcAudio = ctxAudio.createBufferSource();
        srcAudio.buffer = bufferAudio;
        srcAudio.connect(ctxAudio.destination);
        srcAudio.start();
      } else if (typeof bufferAudio.play === 'function') {
        srcAudio = bufferAudio;
        srcAudio.currentTime = 0;
        srcAudio.play().catch(() => {});
      }
    }
  };

  const abortAudioCustomAndPlugin = () => {
    stopAndClearAudioCustom();
    stopAudioPlugin();
  };

  const prepareAudioCustom = async () => {
    try {
      const buffer = await jsPsych.pluginAPI.getAudioBuffer(assetAudio);
      durationAudio = buffer.duration * 1000;
      bufferAudio = buffer;
    } catch {
      bufferAudio = null;
      durationAudio = 0;
    }
  };

  const t_startAudioCustom = () => ({
    timeline: [
      {
        type: jsPsychCallFunction,
        async: true,
        func: (done) => {
          prepareAudioCustom().finally(() => done());
        },
      },
      wrapAsJsPsychTrial(() => startAudioCustom()),
    ],
  });

  return {
    setAssetAudio,
    prepareAudioCustom,
    startAudioCustom,
    stopAudioCustom,
    stopAndClearAudioCustom,
    abortAudioCustomAndPlugin,
    t_startAudioCustom,
    durationAudio: () => durationAudio,
  };
};

export const hasAudio = (keyAudio) => mediaAssets.audio?.[keyAudio] != null;

// @fix-freeze-audio - begin
// ===========================================================
// audio lifecycle
// ===========================================================

const RESPONSE_BUTTON_SELECTOR =
  '.jspsych-audio-multi-response-button, .jspsych-audio-button-response-button, .jspsych-html-multi-response-button';
const TRANSIENT_INPUT_SUPPRESSION_MS = 1000;

let guardsInstalled = false;
let suppressResponseInputUntil = 0;
let shouldResumeCurrentAudio = false;

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const suppressTransientResponseInput = () => {
  suppressResponseInputUntil = Math.max(suppressResponseInputUntil, now() + TRANSIENT_INPUT_SUPPRESSION_MS);
};

const getElementFromEventTarget = (target) => {
  if (typeof Element !== 'undefined' && target instanceof Element) {
    return target;
  }

  return target?.parentElement ?? null;
};

const isAssessmentResponseButtonEvent = (event) => {
  const target = getElementFromEventTarget(event.target);
  return Boolean(target?.closest?.(RESPONSE_BUTTON_SELECTOR));
};

const blockTransientResponseInput = (event) => {
  if (now() > suppressResponseInputUntil || !isAssessmentResponseButtonEvent(event)) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
};

// eslint-disable-next-line no-unused-vars
const resumeAudioContextSimple = () => {
  try {
    const context = jsPsych.pluginAPI.audioContext();

    if (context?.state !== 'running' && typeof context?.resume === 'function') {
      context.resume().catch(() => null);
    }
  } catch {
    return null;
  }

  return null;
};

const resumeAudioContext = () => {
  try {
    const context = jsPsych.pluginAPI.audioContext();
    if (!context) return null;
    if (typeof context.resume === 'function') {
      context.resume().catch(() => null);
    }
    playSilentBuffer(context);
  } catch {
    return null;
  }
  return null;
};

const getCurrentTrialAudioElement = async () => {
  const currentTrial = jsPsych.getCurrentTrial();

  if (
    (currentTrial?.type?.info?.name !== 'audio-button-response' &&
      currentTrial?.type?.info?.name !== 'audio-multi-response' &&
      currentTrial?.type?.info?.name !== 'audio-keyboard-response') ||
    typeof currentTrial.stimulus !== 'string'
  ) {
    return null;
  }

  const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(currentTrial.stimulus);

  if (typeof HTMLAudioElement !== 'undefined' && audioBuffer instanceof HTMLAudioElement) {
    return audioBuffer;
  }

  return null;
};

export const unlockAudioContext = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  if (ctx) {
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    playSilentBuffer(ctx);
  }

  const a = new Audio(mediaAssets.audio.roavMpNullAudioAll);
  a.playsInline = true;
  const playPromise = a.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {});
  }
};

const resumeCurrentAudioElement = async () => {
  if (!shouldResumeCurrentAudio || document.hidden) return;

  let audioElement;
  try {
    audioElement = await getCurrentTrialAudioElement();
  } catch {
    return;
  }

  if (!audioElement) return;
  if (audioElement.ended) {
    shouldResumeCurrentAudio = false;
    return;
  }

  const playPromise = audioElement.play();

  if (playPromise?.then) {
    playPromise
      .then(() => {
        shouldResumeCurrentAudio = false;
      })
      .catch(() => null);
  } else {
    shouldResumeCurrentAudio = false;
  }
};

const resumeAudioWhenActive = () => {
  if (document.visibilityState === 'hidden') return;

  window.setTimeout(resumeAudioContext, 0);
  window.setTimeout(resumeAudioContext, DURATIONS.AUDIO_CONTEXT_RESUME_RETRY);
  window.setTimeout(resumeAudioContext, DURATIONS.AUDIO_CONTEXT_RESUME_RETRY_LONG);

  window.setTimeout(resumeCurrentAudioElement, 0);
  window.setTimeout(resumeCurrentAudioElement, DURATIONS.AUDIO_CONTEXT_RESUME_RETRY);
  window.setTimeout(resumeCurrentAudioElement, DURATIONS.AUDIO_CONTEXT_RESUME_RETRY_LONG);
};

const handleBrowserLifecycleTransition = () => {
  shouldResumeCurrentAudio = true;
  suppressTransientResponseInput();
  resumeAudioWhenActive();
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    shouldResumeCurrentAudio = true;
  }

  suppressTransientResponseInput();

  if (!document.hidden) {
    resumeAudioWhenActive();
  }
};

export const installAssessmentLifecycleGuards = () => {
  if (guardsInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;

  guardsInstalled = true;

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handleBrowserLifecycleTransition);
  window.addEventListener('pageshow', handleBrowserLifecycleTransition);
  window.addEventListener('focus', handleBrowserLifecycleTransition);
  window.addEventListener('orientationchange', handleBrowserLifecycleTransition);
  window.addEventListener('resize', handleBrowserLifecycleTransition);

  document.addEventListener('touchstart', resumeAudioContext, true);
  document.addEventListener('touchstart', resumeCurrentAudioElement, true);
  document.addEventListener('click', resumeAudioContext, true);
  document.addEventListener('click', resumeCurrentAudioElement, true);
  document.addEventListener('click', blockTransientResponseInput, true);
  document.addEventListener('touchend', blockTransientResponseInput, true);
  document.addEventListener('pointerup', blockTransientResponseInput, true);
};
// @fix-freeze-audio - end

// @fix-freeze-audio - begin
// A separate trial to enable audio (previously conditionally tied to a
// gesture in full screen prompt to avoid extra screen).
// A much cleaner separation of audio request; absolutely necessary in case
// of HTML audio because of gesture timing
export const t_enableAudio = () => ({
  type: jsPsychHtmlButtonResponse,
  stimulus: () => {
    const html = `
          <div class="roav-card-sys">
            <div>
              <img src="${mediaAssets.images.sharedTechIconAudioAll}" class="roav-card-sys-img-small">
            </div>
            <br>
            <br>
            <div>
              <h2>${i18next.t('enable-audio.prompt')}</h2>
            </div>
            <br>
            <br>
          </div>`;
    return html;
  },
  button_html: '<button class="roav-button-sys-large">%choice%</button>',
  choices: [i18next.t('enable-audio.label-button')],
  response_allowed_while_playing: true,
  on_finish: () => {
    jsPsych.pluginAPI.audioContext();
  },
});
// @fix-freeze-audio - end
