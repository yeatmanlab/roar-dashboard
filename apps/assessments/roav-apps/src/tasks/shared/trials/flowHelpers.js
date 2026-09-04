import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { sessionSet, sessionGet } from '../helpers/sessionHelpers';
import { wrapAsJsPsychTrial } from '../helpers/jspsychHelpers';
import { ModeGame } from '../helpers/namingHelpers';

export const t_setEnableTrials = (flagEnable) => wrapAsJsPsychTrial(() => sessionSet(SK.ENABLE_TRIALS, flagEnable));

export const t_setEnableTrialsByModeGame = ({ modeGame, flagEnable }) =>
  wrapAsJsPsychTrial(() => {
    if (sessionGet(SK.MODE_GAME) === modeGame) {
      sessionSet(SK.ENABLE_TRIALS, flagEnable);
    }
  });

export const t_enableTrialsOnlyInModeGame = (modeGame) =>
  wrapAsJsPsychTrial(() => {
    const flagEnable = sessionGet(SK.MODE_GAME) === modeGame;
    sessionSet(SK.ENABLE_TRIALS, flagEnable);
  });

export const t_disableTrialsOnlyInModeGame = (modeGame) =>
  wrapAsJsPsychTrial(() => {
    const flagEnable = sessionGet(SK.MODE_GAME) !== modeGame;
    sessionSet(SK.ENABLE_TRIALS, flagEnable);
  });

export const t_setEnableTrialsByModeSeq = ({ modeSeq, flagEnable }) =>
  wrapAsJsPsychTrial(() => {
    if (sessionGet(SK.MODE_SEQ) === modeSeq) {
      sessionSet(SK.ENABLE_TRIALS, flagEnable);
    }
  });

// conditional timeline segments depending on input mode
export const t_setEnableTrialsByModeInputTarget = ({ modeInputTarget, flagEnable }) =>
  wrapAsJsPsychTrial(() => {
    if (sessionGet(SK.MODE_INPUT_TARGET) === modeInputTarget) {
      sessionSet(SK.ENABLE_TRIALS, flagEnable);
    }
  });

export const t_enableTrialsOnlyInModeInputTarget = ({ modeInputTarget }) =>
  wrapAsJsPsychTrial(() => {
    const flagEnable = sessionGet(SK.MODE_INPUT_TARGET) === modeInputTarget;
    sessionSet(SK.ENABLE_TRIALS, flagEnable);
  });

export const t_disableTrialsOnlyInModeInputTarget = ({ modeInputTarget }) =>
  wrapAsJsPsychTrial(() => {
    const flagEnable = sessionGet(SK.MODE_INPUT_TARGET) !== modeInputTarget;
    sessionSet(SK.ENABLE_TRIALS, flagEnable);
  });

// conditional timeline segments depending on correctness ot the last response
export const t_setEnableTrialsByDataCorrect = ({ flagDataCorrect, flagEnable }) =>
  wrapAsJsPsychTrial(() => {
    if (sessionGet(SK.DATA_CORRECT) === flagDataCorrect) {
      sessionSet(SK.ENABLE_TRIALS, flagEnable);
    }
  });

export const skipResponseByModeGame = (modeGameSkipResponse) => {
  const modeGame = sessionGet(SK.MODE_GAME);
  const skipResponse = modeGameSkipResponse === ModeGame.ALL ? true : modeGameSkipResponse === modeGame;
  return skipResponse;
};

export const enableTrialByModeGame = (modeGameTrial) => {
  const enableTrials = sessionGet(SK.ENABLE_TRIALS);
  const modeGame = sessionGet(SK.MODE_GAME);
  return enableTrials && (modeGameTrial === ModeGame.ALL || modeGameTrial === modeGame);
};
