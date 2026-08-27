import { jsPsych } from './jsPsych';

// Longest bundled narration is about 17s. This only fires when Safari loses an audio ended event.
export const AUDIO_END_FALLBACK_MS = 18000;
export const SHORT_AUDIO_END_FALLBACK_MS = 6000;
export const PRACTICE_FEEDBACK_AUDIO_FALLBACK_MS = 8000;

const RESPONSE_BUTTON_SELECTOR = '.jspsych-audio-button-response-button, .jspsych-html-multi-response-button';
const TRANSIENT_INPUT_SUPPRESSION_MS = 1000;
const AUDIO_RESUME_RETRY_DELAYS_MS = [0, 250, 1000];

let guardsInstalled = false;
let audioContextGetterPatched = false;
let pausedForAudioLifecycle = false;
let suppressResponseInputUntil = 0;
let pendingAudioResume = false;
let audioContextPrimed = false;
let shouldRefreshAudioContext = false;

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
  const shouldBlockInput = now() <= suppressResponseInputUntil || pendingAudioResume || pausedForAudioLifecycle;

  if (!shouldBlockInput || !isAssessmentResponseButtonEvent(event)) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
};

const shouldUseWebAudio = () => jsPsych.getInitSettings?.().use_webaudio !== false;

const getWebAudioContext = () => {
  if (!shouldUseWebAudio()) return null;
  return jsPsych.webaudio_context ?? null;
};

const createWebAudioContext = () => {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) return null;

  return new AudioContextConstructor();
};

const markWebAudioContextStale = () => {
  if (!shouldUseWebAudio()) return;

  shouldRefreshAudioContext = true;
  audioContextPrimed = false;
};

const refreshWebAudioContextIfNeeded = () => {
  const currentContext = getWebAudioContext();

  if (!shouldRefreshAudioContext && currentContext?.state === 'running') {
    audioContextPrimed = true;
    return currentContext;
  }

  const shouldRefreshContext =
    shouldRefreshAudioContext || currentContext?.state === 'closed' || currentContext?.state === 'interrupted';

  if (!shouldRefreshContext) return currentContext;

  const nextContext = createWebAudioContext();

  if (!nextContext) return currentContext;

  if (currentContext && currentContext.state !== 'closed' && typeof currentContext.close === 'function') {
    currentContext.close().catch(() => null);
  }

  jsPsych.webaudio_context = nextContext;
  shouldRefreshAudioContext = false;
  audioContextPrimed = false;

  return nextContext;
};

const resumeExperimentFromAudioLifecycle = () => {
  if (!pausedForAudioLifecycle) return;

  pausedForAudioLifecycle = false;
  jsPsych.resumeExperiment();
};

const pauseExperimentForAudioLifecycle = () => {
  if (pausedForAudioLifecycle) return;

  jsPsych.pauseExperiment();
  pausedForAudioLifecycle = true;
};

const primeAudioContext = (context) => {
  if (audioContextPrimed || !context?.createBuffer || !context?.createBufferSource) return;

  try {
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
    audioContextPrimed = context.state === 'running';
  } catch {
    // iPad Safari may reject unlock attempts outside a fresh user gesture.
  }
};

const resumeAudioContext = (context = getWebAudioContext()) => {
  if (!context) {
    pendingAudioResume = false;
    resumeExperimentFromAudioLifecycle();
    return null;
  }

  if (context.state === 'running') {
    audioContextPrimed = true;
    if (!shouldRefreshAudioContext) {
      pendingAudioResume = false;
      resumeExperimentFromAudioLifecycle();
    }
    return null;
  }

  if (context.state === 'closed' || typeof context.resume !== 'function') {
    pendingAudioResume = false;
    resumeExperimentFromAudioLifecycle();
    return null;
  }

  audioContextPrimed = false;
  pendingAudioResume = true;

  try {
    const resumePromise = context.resume();

    if (resumePromise?.then) {
      return resumePromise
        .then(() => {
          if (context.state === 'running') {
            audioContextPrimed = true;
            if (!shouldRefreshAudioContext) {
              pendingAudioResume = false;
              resumeExperimentFromAudioLifecycle();
            }
          }
        })
        .catch(() => null);
    }
  } catch {
    return null;
  }

  if (context.state === 'running') {
    audioContextPrimed = true;
    if (!shouldRefreshAudioContext) {
      pendingAudioResume = false;
      resumeExperimentFromAudioLifecycle();
    }
  }

  return null;
};

const installSafeAudioContextGetter = () => {
  if (audioContextGetterPatched || typeof jsPsych.pluginAPI?.audioContext !== 'function') return;

  audioContextGetterPatched = true;

  jsPsych.pluginAPI.audioContext = () => {
    const context = getWebAudioContext();
    resumeAudioContext(context);
    return context;
  };
};

export const unlockAssessmentAudio = () => {
  const context = refreshWebAudioContextIfNeeded();

  primeAudioContext(context);
  const resumeResult = resumeAudioContext(context);

  if (resumeResult?.then) {
    return resumeResult.then(() => !context || context.state === 'running').catch(() => false);
  }

  return Promise.resolve(!context || context.state === 'running');
};

const resumeAudioWhenActive = () => {
  if (document.visibilityState === 'hidden') return;

  AUDIO_RESUME_RETRY_DELAYS_MS.forEach((delay) => {
    window.setTimeout(resumeAudioContext, delay);
  });
};

const resumeTimelineWhenActive = () => {
  if (document.visibilityState === 'hidden') return;

  window.setTimeout(resumeExperimentFromAudioLifecycle, 0);
};

const handleBrowserLifecycleTransition = () => {
  pendingAudioResume = true;
  suppressTransientResponseInput();
  resumeAudioWhenActive();
  resumeTimelineWhenActive();
};

const handlePageHide = () => {
  pendingAudioResume = true;
  markWebAudioContextStale();
  pauseExperimentForAudioLifecycle();
  suppressTransientResponseInput();
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    pendingAudioResume = true;
    markWebAudioContextStale();
    pauseExperimentForAudioLifecycle();
  }

  suppressTransientResponseInput();

  if (!document.hidden) {
    resumeAudioWhenActive();
    resumeTimelineWhenActive();
  }
};

const handleWindowBlur = () => {
  pendingAudioResume = true;
  markWebAudioContextStale();
  pauseExperimentForAudioLifecycle();
  suppressTransientResponseInput();
};

const handleUserAudioUnlock = () => {
  unlockAssessmentAudio();

  if (pendingAudioResume || pausedForAudioLifecycle) {
    window.setTimeout(resumeAudioContext, 50);
  }
};

export const installAssessmentLifecycleGuards = () => {
  if (guardsInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;

  guardsInstalled = true;
  installSafeAudioContextGetter();

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handleBrowserLifecycleTransition);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleBrowserLifecycleTransition);
  window.addEventListener('orientationchange', handleBrowserLifecycleTransition);
  window.addEventListener('resize', handleBrowserLifecycleTransition);

  document.addEventListener('pointerdown', handleUserAudioUnlock, true);
  document.addEventListener('touchstart', handleUserAudioUnlock, true);
  document.addEventListener('click', handleUserAudioUnlock, true);
  document.addEventListener('click', blockTransientResponseInput, true);
  document.addEventListener('touchend', blockTransientResponseInput, true);
  document.addEventListener('pointerup', blockTransientResponseInput, true);
};
