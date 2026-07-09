import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import '../../../i18n/i18n';
import { fillTextKeyValuesDef, ModeGame, TypeKey } from '../helpers/namingHelpers';
import { fitTextInstructionDef, scrollToTop, startReflowLayout, stopReflowLayout } from '../helpers/layoutHelpers';
import { mediaAssets } from '../helpers/mediaAssets';
import { resetModeInputLast, updateModeInputInfoOnPointerEvent } from './inputModeHelpers';
import { htmlInstructionGeneral } from '../helpers/htmlHelpers';
import { jsPsych } from '../helpers/taskSetup';
import { sessionGet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { DURATIONS } from '../helpers/constants';
import { enableTrialByModeGame, skipResponseByModeGame } from './flowHelpers';
import { t_trialEnterFullscreenConditional } from './screenHelpers';

const tagTrial = 'instruction';

// text - unique, very structured (audio has to be coordinated with video)
const paramsDef = (tagReq) => ({
  tagReq: tagReq,
  text1: [tagTrial, tagReq, 'text1'],
  text2: [tagTrial, tagReq, 'text2'],
  text3: [tagTrial, tagReq, 'text3'],
  text4: [tagTrial, tagReq, 'text4'],
  keyAudio: [tagTrial, tagReq, ''],

  textBtn: ['general', '', 'label-button-next'],

  keyImgCharacter: ['', '', 'character-left'],
  keyImgBg: ['', '', 'bg'],
  keyImgBtnNext: ['', '', 'button-next'],
  inputKeyNext: TypeKey.SPACEBAR,

  animateBtn: false,
  modeGameTrial: ModeGame.ALL,
  modeGameSkipResponse: ModeGame.NONE,

  durationTrial: DURATIONS.INSTRUCTION,

  on_load_ext: null, // hooks for augmenting layout as needed
  on_finish_ext: null,
});

export const t_instructionGeneral = (paramsIn = {}, tagReq = 'def') => {
  let params;
  let skipResponse;
  let keyboardListener = null;
  let callbackReflowLayout = null;

  return {
    timeline: [
      t_trialEnterFullscreenConditional(),
      {
        type: jsPsychCallFunction,
        func: () => {
          // eslint-disable-next-line no-param-reassign
          paramsIn.tagReq ??= tagReq;
          params = {
            ...fillTextKeyValuesDef(paramsDef(paramsIn.tagReq)),
            ...fillTextKeyValuesDef(paramsIn),
          };
          skipResponse = skipResponseByModeGame(params.modeGameSkipResponse);
        },
      },
      {
        timeline: [
          {
            type: jsPsychAudioMultiResponse,
            stimulus: () =>
              mediaAssets.audio[params.keyAudio]
                ? mediaAssets.audio[params.keyAudio]
                : mediaAssets.audio.roavMpNullAudioAll,
            prompt: () => {
              const html = htmlInstructionGeneral(params);
              return html;
            },
            keyboard_choices: () => [],
            button_choices: () => [''],
            button_html: () => '',
            trial_ends_after_audio: () => skipResponse,
            on_start: (trial) => {
              if (!skipResponse) {
                // eslint-disable-next-line no-param-reassign
                trial.trial_duration = params.durationTrial;
              }
            },
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
                  const modeGame = sessionGet(SK.MODE_GAME);
                  const enableKeyNext = modeGame !== ModeGame.GAME && params.inputKeyNext !== '';

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
              callbackReflowLayout = startReflowLayout(fitTextInstructionDef);

              if (params.on_load_ext && typeof params.on_load_ext === 'function') {
                params.on_load_ext();
              }
            },
            on_finish: () => {
              stopReflowLayout(callbackReflowLayout);

              if (keyboardListener) {
                jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
              }
              if (params.on_finish_ext && typeof params.on_finish_ext === 'function') {
                params.on_finish_ext();
              }
            },
          },
        ],
        conditional_function: () => enableTrialByModeGame(params.modeGameTrial),
      },
    ],
  };
};
