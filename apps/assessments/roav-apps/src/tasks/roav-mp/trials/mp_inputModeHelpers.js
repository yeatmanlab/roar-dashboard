import { deviceType } from 'detect-it';
import { ModeGame, ModeInput } from '../../shared/helpers/namingHelpers';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from '../helpers/mp_sessionKeys';
import { wrapAsJsPsychTrial } from '../../shared/helpers/jspsychHelpers';

export const updateModeInputTargetRdk = () => {
  const allowModeInputAll = sessionGet(SK.ALLOW_MODE_INPUT_ALL);

  if (!allowModeInputAll) {
    const modeInputTarget = sessionGet(SK.MODE_INPUT_TARGET);
    const inputKeyLeftDetected = sessionGet(SK.INPUT_KEY_LEFT_DETECTED);
    const inputKeyRightDetected = sessionGet(SK.INPUT_KEY_RIGHT_DETECTED);
    let modeInputTargetNew = modeInputTarget;
    if (modeInputTarget === ModeInput.KEYBOARD) {
      modeInputTargetNew = ModeInput.KEYBOARD;
      if (!inputKeyLeftDetected || !inputKeyRightDetected) {
        modeInputTargetNew = ModeInput.TOUCH;
      }
    }
    sessionSet(SK.MODE_INPUT_TARGET, modeInputTargetNew);
  }
};

export const initModeInputTargetRdk = () => {
  let modeInputTarget = ModeInput.NONE;
  const allowModeInputAll = sessionGet(SK.ALLOW_MODE_INPUT_ALL);
  if (allowModeInputAll) {
    modeInputTarget = ModeInput.ALL;
  } else {
    const modeGame = sessionGet(SK.MODE_GAME);
    if (modeGame === ModeGame.STANDARD) {
      const modeInputTargetAnswer = sessionGet(SK.MODE_INPUT_TARGET_ANSWER);
      if (modeInputTargetAnswer !== undefined) {
        modeInputTarget = modeInputTargetAnswer;
      } else {
        modeInputTarget = ModeInput.KEYBOARD;
      }
    } else if (modeGame === ModeGame.GAME) {
      modeInputTarget = deviceType === 'mouseOnly' ? ModeInput.MOUSE : ModeInput.TOUCH;
    }
  }
  sessionSet(SK.MODE_INPUT_TARGET_INIT, modeInputTarget);
  sessionSet(SK.MODE_INPUT_TARGET, modeInputTarget);
};

export const t_updateModeInputTargetRdk = () =>
  wrapAsJsPsychTrial(() => {
    updateModeInputTargetRdk();
  });

export const t_initModeInputTargetRdk = (allowInputAll) =>
  wrapAsJsPsychTrial(() => {
    initModeInputTargetRdk(allowInputAll);
  });
