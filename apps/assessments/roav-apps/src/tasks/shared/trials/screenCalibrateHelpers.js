import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import "../../../i18n/i18n";
import {
  fillTextKeyValuesDef,
  ModeGame,
  NameTask,
  TAG_REQ_DEF,
  TypeKey,
  TypeSize,
} from "../helpers/namingHelpers";
import { mediaAssets } from "../helpers/mediaAssets";
import { jsPsych } from "../helpers/taskSetup";
import { enableTrialByModeGame, skipResponseByModeGame } from "./flowHelpers";
import { SCREEN } from "../helpers/constants";
import { sessionSet } from "../helpers/sessionHelpers";
import { SESSION_KEYS as SK } from "../helpers/sessionKeys";

const tagTrialScreenMeasureWidth = "screen-measure-width";

const paramsTrialScreenMeasureWidth = (
  tagReq = TAG_REQ_DEF,
  tagModeGame = ModeGame.ALL,
  tagNameTask = NameTask.SHARED,
) => {
  const tagTrial = tagTrialScreenMeasureWidth;
  return {
    tagReq: tagReq,
    tagModeGame: tagModeGame,
    tagNameTask: tagNameTask,
    text1: [tagTrial, tagReq, "text1", tagModeGame, tagNameTask],
    text2: [tagTrial, tagReq, "text2", tagModeGame, tagNameTask],
    text3: [tagTrial, tagReq, "text3", tagModeGame, tagNameTask],
    keyAudio: [tagTrial, tagReq, "", tagModeGame, tagNameTask],
    textBtn: [tagTrial, tagReq, "text-button", tagModeGame, tagNameTask],
    keyImg: "sharedTechIconMeasureScreenWidthAll",
    typeSizeImg: TypeSize.MEDIUM,

    widthScreenCmMin: SCREEN.WIDTH_CM_MIN,
    widthScreenCmMax: SCREEN.WIDTH_CM_MAX,

    modeGameTrial: ModeGame.ALL,
    modeGameSkipResponse: ModeGame.NONE,
  };
};

export const t_screenMeasureWidth = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params;
  let skipResponse;
  let widthScreen = null;

  const prepareParams = () => {
    /* eslint-disable no-param-reassign */
    paramsIn.tagReq ??= tagReq;
    /* eslint-enable no-param-reassign */

    params = {
      ...fillTextKeyValuesDef(
        paramsTrialScreenMeasureWidth(
          paramsIn.tagReq,
          paramsIn.tagModeGame,
          paramsIn.tagNameTask,
        ),
      ),
      ...fillTextKeyValuesDef(paramsIn),
    };
    skipResponse = skipResponseByModeGame(params.modeGameSkipResponse);
  };

  const htmlLayout = () => {
    const classBtnVisible = skipResponse ? "roav-not-visible" : "";
    const hasImg = !!mediaAssets.images[params.keyImg];
    let htmlImg = "";
    if (hasImg) {
      htmlImg = `<img src="${mediaAssets.images[params.keyImg]}" 
          class="shared-tech-card-img-${params.typeSizeImg}"></img>`;
    }
    // alert(htmlImg);

    return `
      <div class="shared-tech-card-container">
        ${htmlImg}
        <div class="shared-tech-card-text-wrap">
          ${params.text1 ? `<p>${params.text1}</p>` : ""}
          ${params.text2 ? `<p>${params.text2}</p>` : ""}
          <br>
          <div class="shared-tech-text-large-neutral">
            ${params.text3 ? `<p>${params.text3}</p>` : ""}
          </div>
          <select id="id-width-screen-cm" class="shared-tech-input" value="" required>
            <option value="" disabled selected></option>
          </select>
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
            stimulus: () =>
              mediaAssets.audio[params.keyAudio] ??
              mediaAssets.audio.sharedNullAudioAll,
            prompt: () => {
              const html = htmlLayout();
              return html;
            },
            keyboard_choices: () => [TypeKey.DUMMY],
            button_choices: () => [],
            button_html: () => "",
            trial_ends_after_audio: () => skipResponse,
            on_load: () => {
              const selWidthScreen =
                document.getElementById("id-width-screen-cm");
              const widthStep = 0.5;
              for (
                let width = SCREEN.WIDTH_CM_MIN;
                width <= SCREEN.WIDTH_CM_MAX;
                width += widthStep
              ) {
                const opt = document.createElement("option");
                opt.value = width;
                opt.textContent = width;
                selWidthScreen.appendChild(opt);
              }

              const btn = document.getElementById("id-button");
              btn.addEventListener("click", () => {
                if (!selWidthScreen.reportValidity()) {
                  return;
                }
                widthScreen = parseFloat(selWidthScreen.value);
                jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
              });
            },
            on_finish: () => {
              sessionSet(SK.WIDTH_SCREEN_CM, widthScreen);
              sessionSet(SK.SCREEN_CALIBRATED, true);
            },
          },
        ],
        conditional_function: () => enableTrialByModeGame(params.modeGameTrial),
      },
    ],
  };
};
