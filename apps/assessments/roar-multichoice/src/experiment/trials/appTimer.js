import store from "store2";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { jsPsych } from "../jsPsych";

export const initAppTimer = () => {
  const cfg = store.session.get("config") || {};
  const maxTime = cfg.maxTime;
  store.session.set("maxTimeReached", false);

  if (maxTime) {
    const startMs = Date.now();
    const maxTimeMs = maxTime * 60_000;

    store.session.set("appTimerStartMs", startMs);

    const timerId = setInterval(() => {
      if (Date.now() - startMs >= maxTimeMs) {
        store.session.set("maxTimeReached", true);
        clearInterval(timerId);
        jsPsych.setProgressBar(1);
      }
    }, 1000);

    store.session.set("maxTimerId", timerId);
  } else {
    store.session.remove("appTimerStartMs");
    store.session.remove("maxTimerId");
  }
};

// This feature allows the dashboard to use maxTime to pass in a time limit for the real trials
// It is recommended to place startAppTimer in the timeline just before the real trials begin
// so that max time does not include preload time, instructions, or practice trials
// (to avoid strange behavior
// if there is an interruption during practice)
// maxTimeReached is initialized to false in the store

// trial to start the application timer
export const startAppTimer = {
  type: jsPsychCallFunction,
  func: () => initAppTimer(),
};

export const clearAppTimer = {
  type: jsPsychCallFunction,
  func: () => {
    const timerId = store.session.get("maxTimerId");
    if (timerId) clearInterval(timerId);
    store.session.remove("maxTimerId");
  },
};

export const isMaxTimeoutReached = () => !!store.session.get("maxTimeReached");

/**
 * Derives total trials from config.numberOfTrials OR from nItemsCore/nItemsSecondary OR from stimulusCountList sum as a fallback.
 * Ensures we never divide by zero.
 */
const getTotalTrials = () => {
  const cfg = store.session.get("config") || {};

  // Priority 1: Use explicit numberOfTrials if provided
  if (typeof cfg.numberOfTrials === "number" && cfg.numberOfTrials > 0) {
    return cfg.numberOfTrials;
  }

  // Priority 2: Calculate based on nItemsCore + nItemsSecondary (initial counts, not remaining)
  const nItemsCore = cfg.nItemsCore;
  const nItemsSecondary = cfg.nItemsSecondary;
  if (typeof nItemsCore === "number") {
    const secondaryCount =
      typeof nItemsSecondary === "number" ? nItemsSecondary : 0;
    const total = nItemsCore + secondaryCount;
    return total;
  }

  // Priority 3: Fall back to stimulusCountList sum
  const stimulusCountList = store.session.get("stimulusCountList") || [];
  const total = stimulusCountList.reduce((a, b) => a + (Number(b) || 0), 0);
  return total || 1; // Ensure we never return 0
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Computes progress by ITEMS: itemsCompleted / totalTrials.
 * If you don't maintain itemsCompleted, this will gracefully fall back to the
 * incremental mode using jsPsych.getProgressBarCompleted().
 */
const getItemProgress = () => {
  const total = getTotalTrials();
  const itemsCompleted = store.session.get("itemsCompleted") || 0;
  const progress = clamp01(itemsCompleted / total);
  return progress;
};

/** Computes progress by TIME: elapsed / maxTime (only if maxTime exists) */
const getTimeProgress = () => {
  const cfg = store.session.get("config") || {};
  const maxTime = cfg.maxTime;
  const startMs = store.session.get("appTimerStartMs");
  if (!maxTime || !startMs) return null;
  const elapsed = Date.now() - startMs;
  return clamp01(elapsed / (maxTime * 60_000));
};

/**
 * Sets the jsPsych progress bar.
 * If maxTime is configured: choose the LARGER of (time progress, item progress).
 * Else: incremental mode: +1/total per call (compatible with your previous usage).
 */
export const updateProgressBar = () => {
  const timeP = getTimeProgress();

  if (timeP !== null) {
    const itemP = getItemProgress();
    jsPsych.setProgressBar(Math.max(timeP, itemP));
    return;
  }

  // No maxTime → incremental behavior
  const total = getTotalTrials();
  const curr = jsPsych.getProgressBarCompleted();
  jsPsych.setProgressBar(clamp01(curr + 1 / total));
};
