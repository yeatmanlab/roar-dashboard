import jsPsychCallFunction from '@jspsych/plugin-call-function';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import '../../../i18n/i18n';
import { fillTextKeyValuesDef, ModeGame, ModeInput, TypeKey } from '../helpers/namingHelpers';
import { mediaAssets } from '../helpers/mediaAssets';
import { jsPsych } from '../helpers/taskSetup';
import { fitTextCardDef, startReflowLayout, stopReflowLayout, scrollToTop } from '../helpers/layoutHelpers';
import {
  updateModeInputInfoOnPointerEvent,
  updateModeInputInfoOnKeyEvent,
  resetModeInputLast,
} from './inputModeHelpers';
import { sessionGet, sessionSet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { DURATIONS } from '../helpers/constants';
import { enableTrialByModeGame, skipResponseByModeGame } from './flowHelpers';

const tagTrial = 'instruction-input-lr';

// tagReq - load corresponding text from translation.json and coordinate with audio
const paramsDef = (tagReq) => ({
  tagReq: tagReq,
  text1: [tagTrial, tagReq, 'text1'],
  text2: [tagTrial, tagReq, 'text2'],
  text3: [tagTrial, tagReq, 'text3'],
  text4: [tagTrial, tagReq, 'text4'],

  keyAudio: [tagTrial, tagReq, ''],

  keyImgBg: [tagTrial, '', 'bg'],
  keyImgCharacter: [tagTrial, '', 'img-card'],

  inputKeyLeft: TypeKey.ARROW_LEFT,
  inputKeyRight: TypeKey.ARROW_RIGHT,
  allowInputKeyAny: true,

  keyImgBtnLeft: ['rdk', '', 'button-left'],
  keyImgBtnRight: ['rdk', '', 'button-right'],

  validateKeyLeft: false, // only one of the keys should be set at a time for consistency
  validateKeyRight: false,
  endTrialOnKeyPress: true,

  showBtnLeft: true,
  showBtnRight: true,

  enableBtnLeft: false,
  enableBtnRight: false,

  animateBtnLeft: false,
  animateBtnRight: false,

  modeKeyboardYesNo: false,

  durationTrial: DURATIONS.INSTRUCTION,
  modeGameTrial: ModeGame.STANDARD,
  modeInputTargetAnswerTrial: ModeInput.KEYBOARD,
  modeInputTargetTrial: ModeInput.KEYBOARD,
  modeGameSkipResponse: ModeGame.NONE,
  dataCorrect: undefined, // important - do not set it to TRUE / FALSE
});

export const t_instructionInputLR = (paramsIn = {}, tagReq = 'def') => {
  let params;

  let btnLeft = null;
  let btnRight = null;

  let skipResponse;

  let callbackReflowLayout = null;

  const endTrial = () => {
    const btnProxy = document.getElementById('jspsych-audio-multi-response-button-0');
    if (btnProxy) {
      btnProxy.click();
    }
  };

  const callbackButtonModeKeyboardYesNo = (leftright) => {
    const modeGame = sessionGet(SK.MODE_GAME);
    if (modeGame === ModeGame.STANDARD) {
      const modeInputTarget = leftright === 'right' ? ModeInput.KEYBOARD : ModeInput.TOUCH;
      sessionSet(SK.MODE_INPUT_TARGET_ANSWER, modeInputTarget);
      sessionSet(SK.MODE_INPUT_TARGET, modeInputTarget);
    }
    endTrial();
  };

  const callbackKeyDown = (e) => {
    const inputKey = e.key.toLowerCase();
    if (params.validateKeyLeft) {
      const dataCorrect = inputKey === params.inputKeyLeft;
      sessionSet(SK.DATA_CORRECT, dataCorrect);
      if (dataCorrect) {
        updateModeInputInfoOnKeyEvent('left');
      }
    }
    if (params.validateKeyRight) {
      const dataCorrect = inputKey === params.inputKeyRight;
      sessionSet(SK.DATA_CORRECT, dataCorrect);
      if (dataCorrect) {
        updateModeInputInfoOnKeyEvent('right');
      }
    }
    if (params.endTrialOnKeyPress) {
      let toEndTrial = true;
      if (!params.allowInputKeyAny) {
        toEndTrial = inputKey === params.inputKeyLeft || inputKey === params.inputKeyRight;
      }
      if (toEndTrial) {
        e.preventDefault();
        endTrial();
      }
    }
  };

  const createButtonInstruction = (leftright) => {
    const modeGame = sessionGet(SK.MODE_GAME);
    const imgBtn =
      leftright === 'left' ? mediaAssets.images[params.keyImgBtnLeft] : mediaAssets.images[params.keyImgBtnRight];

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `roav-button roav-button-lr-large-adaptive-${modeGame} ${leftright}`;

    if (params.modeKeyboardYesNo) {
      btn.addEventListener('click', () => callbackButtonModeKeyboardYesNo(leftright));
    } else {
      btn.addEventListener('pointerdown', (e) => {
        updateModeInputInfoOnPointerEvent(e.pointerType);
      });
      btn.addEventListener('click', endTrial);
    }

    const enableBtn = leftright === 'left' ? params.enableBtnLeft : params.enableBtnRight;
    btn.disabled = !enableBtn;

    const img = document.createElement('img');
    const animate = leftright === 'left' ? params.animateBtnLeft : params.animateBtnRight;
    if (animate) {
      const classAttention = modeGame === ModeGame.GAME ? 'roav-button-attention-strong' : 'roav-button-attention';
      img.classList.add(classAttention);
    }
    img.src = imgBtn;
    btn.appendChild(img);
    const container = jsPsych.getDisplayElement();
    container.appendChild(btn);
    return btn;
  };

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          const paramsInRes = { ...paramsIn };
          paramsInRes.tagReq ??= tagReq;
          params = {
            ...fillTextKeyValuesDef(paramsDef(paramsInRes.tagReq)),
            ...fillTextKeyValuesDef(paramsInRes),
          };
          params.inputKeyLeft = params.inputKeyLeft.toLowerCase();
          params.inputKeyRight = params.inputKeyRight.toLowerCase();

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
              const modeGame = sessionGet(SK.MODE_GAME);
              let htmlImgBg = '';
              if (mediaAssets.images[params.keyImgBg]) {
                htmlImgBg = `<img src="${mediaAssets.images[params.keyImgBg]}" class="roav-img-bg ${modeGame}">`;
              }
              let htmlImgCardWrap = '';
              if (mediaAssets.images[params.keyImgCharacter]) {
                htmlImgCardWrap = `
                  <div class="roav-card-img-wrap">
                    <img src="${mediaAssets.images[params.keyImgCharacter]}" class="roav-card-img">
                  </div>`;
              }

              const typeCard = mediaAssets.images[params.keyImgCharacter] ? 'with-img-text' : 'with-text';

              const html = `
                <div class = "roav-container-viewport-adaptive" id="id-container-bg-card">
                  <div>
                    ${htmlImgBg}
                  </div>
                  <div>
                    <div class="roav-card roav-card-${typeCard} ${modeGame}">
                      ${htmlImgCardWrap}
                      <div class="roav-card-text-wrap ${modeGame}" id="id-text-wrap">
                        <div class="roav-card-text" id="id-text">
                            <h2 class="header-card">${params.text1} </h2>
                            <p class="text-card">${params.text2}</p>
                            <p class="text-card">${params.text3}</p>
                            <p class="text-card">${params.text4}</p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                `;
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
              sessionSet(SK.DATA_CORRECT, false);
            },
            on_load: () => {
              scrollToTop();
              if (params.showBtnLeft) {
                btnLeft = createButtonInstruction('left');
              }
              if (params.showBtnRight) {
                btnRight = createButtonInstruction('right');
              }
              resetModeInputLast();
              const durationDisableClick = DURATIONS.DISABLE_INPUT_SHORT;
              setTimeout(() => {
                if (!params.modeKeyboardYesNo) {
                  document.addEventListener('keydown', callbackKeyDown);
                }
              }, durationDisableClick);
              callbackReflowLayout = startReflowLayout(() => fitTextCardDef(0.75, 2.75), false);
            },
            on_finish: () => {
              if (!params.modeKeyboardYesNo) {
                document.removeEventListener('keydown', callbackKeyDown);
              }
              stopReflowLayout(callbackReflowLayout);
              btnLeft?.remove();
              btnRight?.remove();
              btnLeft = null;
              btnRight = null;
            },
          },
        ],
        conditional_function: () => {
          let enable = enableTrialByModeGame(params.modeGameTrial);
          const allowModeInputAll = sessionGet(SK.ALLOW_MODE_INPUT_ALL);
          if (params.modeKeyboardYesNo) {
            return !allowModeInputAll;
          }
          if (enable) {
            if (params.dataCorrect !== undefined) {
              const dataCorrect = sessionGet(SK.DATA_CORRECT);
              enable = dataCorrect === params.dataCorrect;
            }
          }

          const modeInputTarget = sessionGet(SK.MODE_INPUT_TARGET);
          const modeInputTargetAnswer = sessionGet(SK.MODE_INPUT_TARGET_ANSWER);

          if (enable) {
            enable =
              (allowModeInputAll && params.modeInputTargetTrial === ModeInput.ALL) ||
              params.modeInputTargetTrial === modeInputTarget;
          }

          if (enable) {
            enable =
              (allowModeInputAll && params.modeInputTargetAnswerTrial === ModeInput.ALL) ||
              params.modeInputTargetAnswerTrial === modeInputTargetAnswer;
          }
          return enable;
        },
      },
    ],
  };
};
