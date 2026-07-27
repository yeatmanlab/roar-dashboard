import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import '../../../i18n/i18n';
import { fillTextKeyValuesDef, ModeGame, TAG_REQ_DEF, TypeKey, TypeSize } from '../helpers/namingHelpers';
import { mediaAssets } from '../helpers/mediaAssets';
import { jsPsych } from '../helpers/taskSetup';
import { enableTrialByModeGame, skipResponseByModeGame } from './flowHelpers';

const tagTrialInstructionTech = 'instruction-tech';

export const paramsInstructionTechDef = (
  tagReq = TAG_REQ_DEF,
  tagModeGame = ModeGame.ALL,
  tagNameTask = undefined,
  tagTrial = tagTrialInstructionTech,
) => ({
  tagTrial: tagTrial,
  tagReq: tagReq,
  tagModeGame: tagModeGame, // set to undefined to trigger current game mode
  tagNameTask: tagNameTask,
  text1: [tagTrial, tagReq, 'text1', tagModeGame, tagNameTask],
  text2: [tagTrial, tagReq, 'text2', tagModeGame, tagNameTask],
  text3: [tagTrial, tagReq, 'text3', tagModeGame, tagNameTask],
  text4: [tagTrial, tagReq, 'text4', tagModeGame, tagNameTask],
  textExtra: [tagTrial, tagReq, 'text-extra', tagModeGame, tagNameTask],
  keyAudio: [tagTrial, tagReq, '', tagModeGame, tagNameTask],
  textBtn: [tagTrial, tagReq, 'text-button', tagModeGame, tagNameTask],
  keyImg: ['', '', '', tagModeGame, tagNameTask],
  typeSizeImg: TypeSize.MEDIUM,

  modeGameTrial: ModeGame.ALL,
  modeGameSkipResponse: ModeGame.NONE,

  showLog: false,

  // for adding extra functionality or extending layout
  on_load_ext: null,
  on_finish_ext: null,
});

export const t_instructionTech = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params;
  let skipResponse;

  const prepareParams = () => {
    /* eslint-disable no-param-reassign */
    paramsIn.tagReq ??= tagReq;
    /* eslint-enable no-param-reassign */

    params = {
      ...fillTextKeyValuesDef(
        paramsInstructionTechDef(paramsIn.tagReq, paramsIn.tagModeGame, paramsIn.tagNameTask, paramsIn.tagTrial),
      ),
      ...fillTextKeyValuesDef(paramsIn),
    };
    skipResponse = skipResponseByModeGame(params.modeGameSkipResponse);
  };

  const htmlLayout = () => {
    const classLogVisible = params.showLog ? '' : 'roav-not-visible';
    const classBtnVisible = skipResponse ? 'roav-not-visible' : '';
    const hasImg = !!mediaAssets.images[params.keyImg];
    let htmlImg = '';
    if (hasImg) {
      const classBorderImg = params.borderImg ? 'shared-tech-border' : '';
      htmlImg = `<img src="${mediaAssets.images[params.keyImg]}" 
          class="shared-tech-card-img-${params.typeSizeImg} ${classBorderImg}"></img>`;
    }

    return `
      <div id="id-log" class="roav-card-log ${classLogVisible}"></div>
      <div class="shared-tech-card-container">
        ${htmlImg}
        <div class="shared-tech-card-text-wrap">
          ${params.text1 ? `<p>${params.text1}</p>` : ''}
          ${params.text2 ? `<p>${params.text2}</p>` : ''}
          ${params.text3 ? `<p>${params.text3}</p>` : ''}
          ${params.text4 ? `<p>${params.text4}</p>` : ''}
          <br>
          ${params.textExtra ? `<div class="shared-tech-text-medium-neutral">${params.textExtra}</div>` : ''}
        </div>
        <div class="shared-tech-button-wrap">
            <button id="id-button" class="${classBtnVisible} shared-tech-button-medium">
              ${params.textBtn}
            </button>
        </div>
      </div>`;
  };

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => prepareParams(),
      },
      {
        timeline: [
          {
            type: jsPsychAudioMultiResponse,
            stimulus: () => mediaAssets.audio[params.keyAudio] ?? mediaAssets.audio.sharedNullAudioAll,
            prompt: () => {
              const html = htmlLayout();
              return html;
            },
            keyboard_choices: () => [TypeKey.DUMMY],
            button_choices: () => [],
            button_html: () => '',
            trial_ends_after_audio: () => skipResponse,
            on_load: () => {
              const btn = document.getElementById('id-button');
              btn.addEventListener('click', () => jsPsych.pluginAPI.pressKey(TypeKey.DUMMY));
              if (params.on_load_ext && typeof params.on_load_ext === 'function') {
                params.on_load_ext();
              }
            },
            on_finish: () => {
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
