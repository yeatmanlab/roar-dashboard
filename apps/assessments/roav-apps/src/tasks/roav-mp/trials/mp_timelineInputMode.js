import { t_instructionInputLR } from '../../shared/trials/instructionInputLR';
import { t_initModeInputTargetRdk, t_updateModeInputTargetRdk } from './mp_inputModeHelpers';
import { t_instructionGeneral } from '../../shared/trials/instructionGeneral';
import { t_enableTrialsOnlyInModeInputTarget, t_setEnableTrials } from '../../shared/trials/flowHelpers';
import { ModeGame, ModeInput, TypeKey } from '../../shared/helpers/namingHelpers';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from '../helpers/mp_sessionKeys';
import { DURATIONS } from '../../shared/helpers/constants';

export const t_timelineInputMode = () => ({
  timeline: [
    // IMPORTANT: this trial directly resets modeInputTargetAnswer & modeInputTarget
    t_instructionInputLR(
      {
        modeGameTrial: ModeGame.STANDARD,
        durationTrial: DURATIONS.RESPONSE_INPUT_TYPE,
        keyImgCharacter: ['', '', 'keyboard'],
        keyImgBtnLeft: ['', '', 'button-no'],
        keyImgBtnRight: ['', '', 'button-yes'],
        enableBtnLeft: true,
        enableBtnRight: true,
        animateBtnLeft: true,
        animateBtnRight: true,
        inputKeyLeft: TypeKey.DUMMY,
        inputKeyRight: TypeKey.DUMMY,
        modeKeyboardYesNo: true,
        modeInputTargetTrial: ModeInput.ALL,
        modeInputTargetAnswerTrial: ModeInput.ALL,
      },
      'instr-physical-keyboard',
    ),
    t_initModeInputTargetRdk(),
    t_instructionInputLR(
      {
        enableBtnLeft: true,
        enableBtnRight: true,
        animateBtnLeft: true,
        animateBtnRight: true,
        modeGameTrial: ModeGame.STANDARD,
        modeInputTargetAnswerTrial: ModeInput.TOUCH,
        modeInputTargetTrial: ModeInput.TOUCH,
        endTrialOnKeyPress: false,
      },
      'instr-input-buttons',
    ),
    t_enableTrialsOnlyInModeInputTarget({
      modeInputTarget: ModeInput.KEYBOARD,
    }),
    t_instructionGeneral(
      {
        keyImgBg: '',
        keyImgCharacter: ['', '', 'input-arrow-keys'],
        animateBtn: true,
        modeGameTrial: ModeGame.STANDARD,
      },
      'instr-input-arrows',
    ),

    // right arrow
    t_instructionInputLR(
      {
        validateKeyRight: true,
        enableBtnLeft: false,
        showBtnLeft: false,
        modeGameTrial: ModeGame.STANDARD,
        durationTrial: DURATIONS.RESPONSE_INPUT_KEY,
      },
      'instr-input-keyboard-right',
    ),
    t_instructionInputLR(
      {
        validateKeyRight: true,
        showBtnLeft: false,
        modeGameTrial: ModeGame.STANDARD,
        durationTrial: DURATIONS.RESPONSE_INPUT_KEY,
        dataCorrect: false,
      },
      'instr-input-keyboard-right-incorrect-1',
    ),
    t_instructionInputLR(
      {
        showBtnLeft: false,
        modeGameTrial: ModeGame.STANDARD,
        dataCorrect: false,
      },
      'instr-input-keyboard-right-incorrect-2',
    ),
    t_instructionInputLR(
      {
        showBtnLeft: false,
        modeGameTrial: ModeGame.STANDARD,
        dataCorrect: true,
      },
      'instr-input-keyboard-right-correct',
    ),

    // left arrow
    t_instructionInputLR(
      {
        validateKeyLeft: true,
        showBtnRight: false,
        modeGameTrial: ModeGame.STANDARD,
        durationTrial: DURATIONS.RESPONSE_INPUT_KEY,
      },
      'instr-input-keyboard-left',
    ),
    t_instructionInputLR(
      {
        validateKeyLeft: true,
        showBtnRight: false,
        modeGameTrial: ModeGame.STANDARD,
        durationTrial: DURATIONS.RESPONSE_INPUT_KEY,
        dataCorrect: false,
      },
      'instr-input-keyboard-left-incorrect-1',
    ),
    t_instructionInputLR(
      {
        showBtnRight: false,
        modeGameTrial: ModeGame.STANDARD,
        dataCorrect: true,
      },
      'instr-input-keyboard-left-correct',
    ),

    // input mode update
    t_updateModeInputTargetRdk(),

    // spacebar navigation
    t_enableTrialsOnlyInModeInputTarget({
      modeInputTarget: ModeInput.KEYBOARD,
    }),
    t_instructionGeneral(
      {
        keyImgBg: '',
        keyImgCharacter: ['', '', 'key-spacebar'],
        modeGameTrial: ModeGame.STANDARD,
      },
      'navigation-spacebar',
    ),
    t_setEnableTrials(true),

    // on-screen buttons as fallback
    t_instructionInputLR(
      {
        enableBtnLeft: true,
        enableBtnRight: true,
        animateBtnLeft: true,
        animateBtnRight: true,
        modeGameTrial: ModeGame.STANDARD,
        modeInputTargetTrial: ModeInput.TOUCH,
        modeInputTargetAnswerTrial: ModeInput.KEYBOARD,
        endTrialOnKeyPress: false,
      },
      'instr-input-buttons-fallback',
    ),
  ],
  conditional_function: () => {
    const enableModeInputAll = sessionGet(SK.ALLOW_MODE_INPUT_ALL);
    return !enableModeInputAll;
  },
});
