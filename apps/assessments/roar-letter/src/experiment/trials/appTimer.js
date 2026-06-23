import store from 'store2';
import jsPsychCallFunction from '@jspsych/plugin-call-function';

export const initAppTimer = () => {
  const { maxTime } = store.session.get('config');

  if (maxTime) {
    const startTime = Date.now();
    const maxTimeMs = maxTime * 60000;
    const timerId = setInterval(() => {
      if (Date.now() - startTime >= maxTimeMs) {
        store.session.set('maxTimeReached', true);
        // eslint-disable-next-line no-console
        console.log(`AppTimer expired after:${maxTimeMs}ms`);
        clearInterval(timerId);
      }
    }, 1000); // Check every second
    store.session.set('maxTimerId', timerId);
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
  func: function () {
    initAppTimer();
  },
};

// trial to clear the application timer
export const clearAppTimer = {
  type: jsPsychCallFunction,
  func: function () {
    if (store.session('config').maxTime) {
      clearTimeout(store.session.get('maxTimerId'));
    }
  },
};

export const isMaxTimeoutReached = () => store.session.get('maxTimeReached');
