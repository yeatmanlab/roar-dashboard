import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import '../../../i18n/i18n';
import { fillTextKeyValuesDef, ModeGame, TypeKey } from '../helpers/namingHelpers';
import { fitTextInstructionDef, scrollToTop, startReflowLayout, stopReflowLayout } from '../helpers/layoutHelpers';
import { mediaAssets } from '../helpers/mediaAssets';
import { resetModeInputLast, updateModeInputInfoOnPointerEvent } from './inputModeHelpers';
import { jsPsych } from '../helpers/taskSetup';
import { htmlInstructionGeneral } from '../helpers/htmlHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { sessionGet } from '../helpers/sessionHelpers';
import { DURATIONS } from '../helpers/constants';
import { enableTrialByModeGame, skipResponseByModeGame } from './flowHelpers';

const tagTrial = 'feedback-av';

const paramsDef = (tagReq) => ({
  tagReq: tagReq,

  paramsCorrect: {
    text1: [tagTrial, `${tagReq}.correct`, 'text1'],
    text2: [tagTrial, `${tagReq}.correct`, 'text2'],
    text3: [tagTrial, `${tagReq}.correct`, 'text3'],
    keyAudio: [tagTrial, tagReq, 'correct'],
    keyImgCharacter: [tagTrial, tagReq, 'correct-character'],
  },

  paramsIncorrect: {
    text1: [tagTrial, `${tagReq}.incorrect`, 'text1'],
    text2: [tagTrial, `${tagReq}.incorrect`, 'text2'],
    text3: [tagTrial, `${tagReq}.incorrect`, 'text3'],
    keyAudio: [tagTrial, tagReq, 'incorrect'],
    keyImgCharacter: [tagTrial, tagReq, 'incorrect-character'],
  },

  keyImgBg: ['', '', 'bg'],
  keyImgBtnNext: ['', '', 'button-next'],

  textBtn: ['general', '', 'label-button-next'],

  animateBtn: false,
  modeGameTrial: ModeGame.ALL,
  modeGameSkipResponse: ModeGame.ALL,

  inputKeyNext: sessionGet(SK.MODE_GAME) === ModeGame.GAME ? TypeKey.DUMMY : TypeKey.SPACEBAR, // " " for space bar
});

export const t_feedbackAudioVisual = (paramsIn = {}, tagReq = 'def') => {
  let params = {};
  let skipResponse;
  let callbackReflowLayout = null;

  const trialFeedback = () => {
    let keyboardListener = null;

    return {
      type: jsPsychAudioMultiResponse,
      stimulus: () =>
        mediaAssets.audio[params.keyAudio] ? mediaAssets.audio[params.keyAudio] : mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => {
        const html = htmlInstructionGeneral(params);
        return html;
      },
      keyboard_choices: () => [],
      button_choices: () => [''],
      button_html: () => `
        `,
      trial_ends_after_audio: () => skipResponse,
      on_load: () => {
        scrollToTop();
        const endTrial = () => {
          const btnProxy = document.getElementById('jspsych-audio-multi-response-button-0');
          if (btnProxy) {
            btnProxy.click();
          }
        };

        const btn = document.getElementById('id-button-next');

        const durationDisableClick = DURATIONS.DISABLE_INPUT_MEDIUM;
        if (btn) {
          btn.addEventListener('click', endTrial);

          btn.addEventListener('pointerdown', (e) => {
            updateModeInputInfoOnPointerEvent(e.pointerType);
          });

          btn.classList.add('roav-button-img-disabled');
          btn.disabled = true;

          setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('roav-button-img-disabled');

            const enableKeyNext = params.inputKeyNext !== TypeKey.DUMMY && !skipResponse;
            if (enableKeyNext) {
              keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
                callback_function: endTrial,
                valid_responses: [TypeKey.SPACEBAR],
                persist: false,
                allow_held_key: false,
              });
            }
          }, durationDisableClick);
        }
        resetModeInputLast();
        callbackReflowLayout = startReflowLayout(fitTextInstructionDef, false);
      },
      on_finish: () => {
        stopReflowLayout(callbackReflowLayout);
        if (keyboardListener) {
          jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
          keyboardListener = null;
        }
      },
    };
  };

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          // eslint-disable-next-line no-param-reassign
          paramsIn.tagReq ??= tagReq;
          params = {
            ...fillTextKeyValuesDef(paramsDef(paramsIn.tagReq)),
            ...fillTextKeyValuesDef(paramsIn),
          };

          const dataCorrect = sessionGet(SK.DATA_CORRECT);
          const paramsCorrectIncorrect = dataCorrect ? params.paramsCorrect : params.paramsIncorrect;
          params = { ...params, ...paramsCorrectIncorrect };

          skipResponse = skipResponseByModeGame(params.modeGameSkipResponse);
        },
      },
      {
        timeline: [trialFeedback()],
        conditional_function: () => enableTrialByModeGame(params.modeGameTrial),
      },
    ],
  };
};
