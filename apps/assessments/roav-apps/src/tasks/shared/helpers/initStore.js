import store from 'store2';
import { sessionHas, sessionSet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

export const clearStoreOnTimelineStartDef = () => {
  sessionSet(SK.FPS, undefined);
  sessionSet(SK.WIDTH_WINDOW_FS, undefined);
  sessionSet(SK.HEIGHT_WINDOW_FS, undefined);
  sessionSet(SK.WIDTH_SCREEN_CM, null);
  sessionSet(SK.HEIGHT_SCREEN_CM, null);

  sessionSet(SK.ALLOW_MODE_INPUT_ALL, undefined);
  sessionSet(SK.MODE_INPUT_TARGET, undefined);
  sessionSet(SK.MODE_INPUT_TARGET_ANSWER, undefined);
  sessionSet(SK.MODE_INPUT_TARGET_INIT, undefined);
  sessionSet(SK.MODE_INPUT_LAST, undefined);
  sessionSet(SK.INPUT_TOUCH_DETECTED, false);
  sessionSet(SK.INPUT_MOUSE_DETECTED, false);
  sessionSet(SK.INPUT_KEY_LEFT_DETECTED, false);
  sessionSet(SK.INPUT_KEY_RIGHT_DETECTED, false);

  sessionSet(SK.ENABLE_TRIALS, true);
  sessionSet(SK.DATA_CORRECT, null);

  // within block
  sessionSet(SK.NUM_TRIAL, 0);
  sessionSet(SK.IND_TRIAL, 0);
  sessionSet(SK.CNT_TRIAL, 0);
  sessionSet(SK.CNT_CORR, 0);

  // global
  sessionSet(SK.IND_TRIAL_GLOBAL, 0);
  sessionSet(SK.CNT_TRIAL_GLOBAL, 0);
  sessionSet(SK.CNT_CORR_GLOBAL, 0);

  sessionSet(SK.IND_BLOCK, 0);

  // measures
  sessionSet(SK.SCREEN_CALIBRATED, false);
};

export const clearStoreOnAppStartDef = () => {
  sessionSet(SK.NAME_TASK, undefined);
  sessionSet(SK.NAME_CORPUS, undefined);
  sessionSet(SK.SCRIPT_TIMELINE, null);
  sessionSet(SK.MODE_GAME, undefined);
  sessionSet(SK.MODE_SEQ, undefined);
  sessionSet(SK.MODE_ADAPT_BLOCK, undefined);
  sessionSet(SK.MODE_ADAPT_STIM, undefined);

  sessionSet(SK.SCREEN_CALIBRATE, false);

  sessionSet(SK.CONFIG_BLOCK, {});
};

export const initStore = (clearStoreOnAppStart, clearStoreOnTimelineStart) => {
  if (sessionHas(SK.SESSION_INITIALIZED)) {
    return store.session;
  }
  clearStoreOnAppStart();
  clearStoreOnTimelineStart();
  sessionSet(SK.SESSION_INITIALIZED, true);
  return store.session;
};
