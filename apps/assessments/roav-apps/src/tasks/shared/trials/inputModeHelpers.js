import { deviceType, primaryInput } from 'detect-it';
import { ModeInput } from '../helpers/namingHelpers';
import { sessionGet, sessionSet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { wrapAsJsPsychTrial } from '../helpers/jspsychHelpers';

export const resetModeInputLast = () => {
  sessionSet(SK.MODE_INPUT_LAST, ModeInput.NONE);
};

export const updateModeInputInfoOnPointerEvent = (pointerType) => {
  if (pointerType === 'touch' || pointerType === 'pen') {
    sessionSet(SK.INPUT_TOUCH_DETECTED, true);
    sessionSet(SK.MODE_INPUT_LAST, ModeInput.TOUCH);
  } else if (pointerType === 'mouse') {
    sessionSet(SK.INPUT_MOUSE_DETECTED, true);
    sessionSet(SK.MODE_INPUT_LAST, ModeInput.MOUSE);
  }
};

export const updateModeInputInfoOnKeyEvent = (leftright) => {
  if (leftright === 'left') {
    sessionSet(SK.INPUT_KEY_LEFT_DETECTED, true);
  } else if (leftright === 'right') {
    sessionSet(SK.INPUT_KEY_RIGHT_DETECTED, true);
  }
  sessionSet(SK.MODE_INPUT_LAST, ModeInput.KEYBOARD);
};

export const updateModeInputTarget = () => {
  const inputMouseDetected = sessionGet(SK.INPUT_MOUSE_DETECTED);
  const inputTouchDetected = sessionGet(SK.INPUT_TOUCH_DETECTED);
  const modeInputTarget = sessionGet(SK.MODE_INPUT_TARGET);

  const inputKeyLeftDetected = sessionGet(SK.INPUT_KEY_LEFT_DETECTED);
  const inputKeyRightDetected = sessionGet(SK.INPUT_KEY_RIGHT_DETECTED);

  let modeInputTargetNew = modeInputTarget;
  if (modeInputTarget === ModeInput.TOUCH) {
    if (!inputTouchDetected && inputMouseDetected) {
      modeInputTargetNew = ModeInput.MOUSE;
    }
  } else if (modeInputTarget === ModeInput.MOUSE) {
    if (inputTouchDetected) {
      modeInputTargetNew = ModeInput.TOUCH;
    }
  }
  if (modeInputTarget === ModeInput.KEYBOARD) {
    if (!inputKeyLeftDetected || !inputKeyRightDetected) {
      modeInputTargetNew = ModeInput.TOUCH;
    }
  }

  sessionSet(SK.MODE_INPUT_TARGET, modeInputTargetNew);
};

export const initModeInputTarget = () => {
  const inputTouchDetected = sessionGet(SK.INPUT_TOUCH_DETECTED);
  let modeInputTarget = ModeInput.MOUSE;

  if (inputTouchDetected) {
    modeInputTarget = ModeInput.TOUCH;
  }
  const isMobile = deviceType === 'touchOnly' || (deviceType === 'hybrid' && primaryInput === 'touch');
  if (isMobile) {
    modeInputTarget = ModeInput.TOUCH;
  }
  // check that this is what we want - we want to encourage touch or keyboard
  // if ((modeGame === ModeGame.STANDARD) && (deviceType === "hybrid")) {
  if (deviceType === 'hybrid') {
    modeInputTarget = ModeInput.TOUCH;
  }

  sessionSet(SK.MODE_INPUT_TARGET, modeInputTarget);
};

export const t_setAllowModeInputAll = (allowModeInputAll) =>
  wrapAsJsPsychTrial(() => {
    sessionSet(SK.ALLOW_MODE_INPUT_ALL, allowModeInputAll);
  });

export const t_updateModeInputTarget = () =>
  wrapAsJsPsychTrial(() => {
    updateModeInputTarget();
  });

export const t_initModeInputTarget = () =>
  wrapAsJsPsychTrial(() => {
    initModeInputTarget();
  });

export const t_setModeInputTarget = (modeInputTarget) =>
  wrapAsJsPsychTrial(() => {
    sessionSet(SK.MODE_INPUT_TARGET, modeInputTarget);
  });

export const createHelperMouseMoveRecord = () => {
  // current time in ms
  const timeNow = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };

  let timeStart = -1;
  let timePointerMoveFirst = -1;
  let timePointerMoveLast = -1;
  const timesPointerMove = [];
  let callbackOnPointerMove = null;

  const startRecord = () => {
    timeStart = timeNow();
    callbackOnPointerMove = (e) => {
      const timeMove = Math.round(timeNow() - timeStart);
      const typeMove = e.pointerType;

      if (typeMove === 'mouse') {
        if (timePointerMoveFirst < 0) {
          timePointerMoveFirst = timeMove;
        }
        timePointerMoveLast = timeMove;
        timesPointerMove.push(timeMove);
      }
    };
    window.addEventListener('pointermove', callbackOnPointerMove);
  };

  const stopRecord = () => {
    if (callbackOnPointerMove) {
      window.removeEventListener('pointermove', callbackOnPointerMove);
      callbackOnPointerMove = null;
    }
  };

  return {
    timePointerMoveFirst: () => timePointerMoveFirst,
    timePointerMoveLast: () => timePointerMoveLast,
    timesPointerMove: () => timesPointerMove,
    startRecord: () => startRecord(),
    stopRecord: () => stopRecord(),
  };
};
