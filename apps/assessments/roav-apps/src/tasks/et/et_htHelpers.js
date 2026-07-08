import jsPsychAudioButtonResponse from "@jspsych/plugin-audio-button-response";
// import jsPsychCallFunction from "@jspsych/plugin-call-function";
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../shared/helpers/mediaAssets";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";
import { jsPsych } from "../shared/helpers/taskSetup";
import {
  et_stateResetOngoing,
  et_TypeSaveSnapshots,
  state,
  t_et_stateSave,
} from "./et_state";
import {
  fm_fmRun,
  fm_xMinFromCoords,
  fm_xMaxFromCoords,
  fm_yMinFromCoords,
  fm_yMaxFromCoords,
  fm_drawBB,
  fm_drawContour,
  fm_calcCentroid,
  fm_drawPoint,
  fm_def_fillStateOnResultsFm,
  fm_calcMetricsHead,
} from "./et_fmHelpers";

import {
  et_videoCardHtml,
  et_videoInit,
  et_videoPause,
  et_videoStart,
  // et_videoStop,
} from "./et_videoHelpers";
import { ET } from "./et_constants";
import {
  fillTextKeyValuesDef,
  ModeGame,
  NameTask,
  TAG_REQ_DEF,
  TypeKey,
} from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";
import { t_instructionTech } from "../shared/trials/instructionTech";
import { et_calcMedianArrStruct, et_calcMedianTrimArrStruct } from "./et_utils";

const TypeMoveHead = {
  MOVE_RIGHT: "move-right",
  MOVE_LEFT: "move-left",
  ROTATE_RIGHT: "rotate-right",
  ROTATE_LEFT: "rotate-left",
  TILT_RIGHT: "tilt-right",
  TILT_LEFT: "tilt-left",
  NONE: "none",
};

// tolMove -- in percent of width (full width 1)
// tolRotate -- ratio of head centroid to min / max of heads
// tolTilt -- ratio to the height of eye's BB

const typeMoveHeadToCenter = (
  coordsHead,
  coordsEyeL,
  coordsEyeR,
  tolMove = 0.05,
  tolRotate = 0.1,
  tolTilt = 0.35,
) => {
  const centroidHead = fm_calcCentroid(coordsHead);
  if (centroidHead[0] < 0.5 - tolMove) {
    return TypeMoveHead.MOVE_RIGHT;
  }
  if (centroidHead[0] > 0.5 + tolMove) {
    return TypeMoveHead.MOVE_LEFT;
  }

  const xMinHead = fm_xMinFromCoords(coordsHead);
  const xMaxHead = fm_xMaxFromCoords(coordsHead);
  const xMinEyeL = fm_xMinFromCoords(coordsEyeL);
  const xMaxEyeL = fm_xMaxFromCoords(coordsEyeL);
  const xMinEyeR = fm_xMinFromCoords(coordsEyeR);
  const xMaxEyeR = fm_xMaxFromCoords(coordsEyeR);
  const xMinEye = Math.min(xMinEyeL, xMinEyeR);
  const xMaxEye = Math.max(xMaxEyeL, xMaxEyeR);
  const dxHead = xMaxHead - xMinHead;
  if (xMinEye < xMinHead + tolRotate * dxHead) {
    return TypeMoveHead.ROTATE_RIGHT;
  }
  if (xMaxEye > xMaxHead - tolRotate * dxHead) {
    return TypeMoveHead.ROTATE_LEFT;
  }
  const yMinEyeL = fm_yMinFromCoords(coordsEyeL);
  const yMaxEyeL = fm_yMaxFromCoords(coordsEyeL);
  const yMinEyeR = fm_yMinFromCoords(coordsEyeR);
  const yMaxEyeR = fm_yMaxFromCoords(coordsEyeR);
  const dyEyeL = yMaxEyeL - yMinEyeL;
  const dyEyeR = yMaxEyeR - yMinEyeR;
  const dyEyeAver = (dyEyeL + dyEyeR) / 2;
  const yCenterL = (yMinEyeL + yMaxEyeL) / 2;
  const yCenterR = (yMinEyeR + yMaxEyeR) / 2;
  // TODO: MIRROR EYES???
  if (yCenterL < yCenterR - tolTilt * dyEyeAver) {
    return TypeMoveHead.TILT_LEFT;
  }
  if (yCenterL > yCenterR + tolTilt * dyEyeAver) {
    return TypeMoveHead.TILT_RIGHT;
  }
  return TypeMoveHead.NONE;
};

const PERC_TRIM_LOW_IRIS = 30;

// those are references from last SAVE METRICS
// TODO: also all of that is in PIXELS??? of the camera IMAGE???
// why not in just fractions -- as output from faceMesh???

// TODO: coordsHeadAux -- do we want to save it in any way?????
// contourHead: state.coordsHeadAux, // TODO: this should not be here --- should be middle of contours????
// TODO: this should not be here!!!!!!!!!!!!!
//  state.configCalibr = config;
//  store.session.set(SK.CALIBR_HT, config);

export const et_vdCalcFlMult = (widthImg, heightImg) =>
  Math.min(widthImg, heightImg);

export const et_vdCalcVd = (
  sizeIrisL,
  sizeIrisR,
  flNorm,
  widthImg,
  heightImg,
) => {
  const sizeIrisWorld = ET.SIZE_IRIS_WORLD_DEF;
  const flMult = et_vdCalcFlMult(widthImg, heightImg);
  const fl = flMult * flNorm;
  const vdL = (fl * (sizeIrisWorld / (sizeIrisL * widthImg))) / 10.0;
  const vdR = (fl * (sizeIrisWorld / (sizeIrisR * widthImg))) / 10.0;
  const vd = (vdL + vdR) / 2;
  return vd;
};

export const et_vdCalcFlNorm = (
  sizeIrisL,
  sizeIrisR,
  vd,
  widthImg,
  heightImg,
) => {
  const sizeIrisWorld = ET.SIZE_IRIS_WORLD_DEF;
  const flMult = et_vdCalcFlMult(widthImg, heightImg);
  const flL = (10 * sizeIrisL * vd * widthImg) / sizeIrisWorld;
  const flR = (10 * sizeIrisR * vd * widthImg) / sizeIrisWorld;
  const fl = (flL + flR) / 2;
  const flNorm = fl / flMult;
  return flNorm;
};

export const et_vdApplyCalibr = (
  vdCalibr,
  arrMetricsIris,
  percTrimLowIris = PERC_TRIM_LOW_IRIS,
) => {
  state.cal.vdCalibrated = false;
  if (arrMetricsIris.length > 0) {
    const widthMedianIrisL = et_calcMedianTrimArrStruct(
      arrMetricsIris,
      "widthIrisL",
      percTrimLowIris,
    );
    const widthMedianIrisR = et_calcMedianTrimArrStruct(
      arrMetricsIris,
      "widthIrisR",
      percTrimLowIris,
    );

    state.cal.vd.flNorm = et_vdCalcFlNorm(
      widthMedianIrisL,
      widthMedianIrisR,
      vdCalibr,
      state.widthImg,
      state.heightImg,
    );
    state.cal.vd.flMult = et_vdCalcFlMult(state.widthImg, state.heightImg);
    state.cal.vd.vd = vdCalibr;
    state.cal.vd.sizeIris = (widthMedianIrisL + widthMedianIrisR) / 2;
    state.cal.vdCalibrated = true;
  }
};

export const et_htApplyCalibr = (arrMetricsHead, coordsHeadMid) => {
  state.cal.htCalibrated = false;
  if (arrMetricsHead.length > 0) {
    const metricsMedianHead = {
      widthHead: et_calcMedianArrStruct(arrMetricsHead, "widthHead"),
      heightHead: et_calcMedianArrStruct(arrMetricsHead, "heightHead"),
      xCenterHead: et_calcMedianArrStruct(arrMetricsHead, "xCenterHead"),
      yCenterHead: et_calcMedianArrStruct(arrMetricsHead, "yCenterHead"),
    };
    state.cal.ht = { ...metricsMedianHead };
    state.cal.ht.coordsHead = coordsHeadMid;
    state.cal.htCalibrated = true;
  }
};

// ============================================================
//  PROD
// ============================================================

export const ht_def_fillStateOnResultsFm = () => {
  if (state.cal.vdCalibrated && state.metricsIris) {
    if (state.metricsIris.widthIrisL && state.metricsIris.widthIrisR) {
      state.vdCur = et_vdCalcVd(
        state.metricsIris.widthIrisL,
        state.metricsIris.widthIrisR,
        state.cal.vd.flNorm,
        state.widthImg,
        state.heightImg,
      );
    }
  }
  state.metricsHead = fm_calcMetricsHead(state.coordsHead);
};

// ------------------------------------------------------------
//  ht_def_onResultsFaceMesh
//  default saving of head and iris points & metrics
// ------------------------------------------------------------

export function vd_calibr_onResultsFaceMesh(resFm) {
  if (!resFm.multiFaceLandmarks) {
    return;
  }
  // state.canvasNativeEyeL = null;
  // state.canvasNativeEyeR = null;
  // state.canvasScaledEyeL = null;
  // state.canvasScaledEyeR = null;

  fm_def_fillStateOnResultsFm(resFm);
  ht_def_fillStateOnResultsFm();
}

// -----------------------------------------------------------
// t_et_vdCalibr
// -----------------------------------------------------------

const tagTrialVdCalibr = "vd-calibr";

const paramsVdCalibrDef = (
  tagReq = TAG_REQ_DEF,
  tagModeGame = ModeGame.ALL,
  tagNameTask = NameTask.ET,
) => ({
  tagTrial: tagTrialVdCalibr,
  tagReq: tagReq,
  tagModeGame: tagModeGame, // hint: set to undefined to trigger current game mode
  tagNameTask: tagNameTask, // hint: set to undefined to trigger current task
  vdCalibr: ET.VD_DEF,
  durCalibr: ET.HT.DUR_CALIBR,
  keyImgNoGlasses: "sharedTechIconNoGlassesAll",
  keyImgMeasureVd: "sharedTechIconMeasureVdAll", // TODO: change to dist
});

// FALLBACK
// camera enabled (VIDEO_ENABLED = true)
// but no setup for measuring viewing distance (VD_CALIBRATE = false)
// CALIBRATION
// camera enabled (VIDEO_ENABLED = true)
// and setup for measuring viewing distance (VD_CALIBRATE)
export const t_et_vdCalibr = (paramsIn = {}) => {
  let params = null;
  let paramsStage = null;

  const arrMetricsIris = [];
  const arrMerticsHead = [];
  let coordsHeadMid = null;

  const StageTrial = {
    NO_GLASSES: "no-glasses",
    MEASURE_VD: "measure-vd",
    CENTER: "center",
    CALIBRATE: "calibrate",
    FINISH: "finish",
  };

  // class="shared-tech-card-img-xl",
  const htmlLayout = (stageTrial) => {
    const paramsCard = {
      text1: paramsStage.text1,
      text2: paramsStage.text2,
      text3: paramsStage.text3,
      showLineMidVert: false,
      showProgressBar: stageTrial === StageTrial.CALIBRATE,
      showLog: true,
      textBtn1: paramsStage.textBtn,
      idBtn1: stageTrial === StageTrial.CALIBRATE ? "" : "id-button",
    };
    return et_videoCardHtml(paramsCard);
  };

  const prepareParamsStage = (stageTrial) => {
    params = { ...paramsVdCalibrDef(), ...paramsIn };
    const { tagTrial, tagReq, tagModeGame, tagNameTask } = params;
    const paramsStageIn = {
      text1: [
        tagTrial,
        `${tagReq}.${stageTrial}`,
        "text1",
        tagModeGame,
        tagNameTask,
      ],
      text2: [
        tagTrial,
        `${tagReq}.${stageTrial}`,
        "text2",
        tagModeGame,
        tagNameTask,
      ],
      text3: [
        tagTrial,
        `${tagReq}.${stageTrial}`,
        "text3",
        tagModeGame,
        tagNameTask,
      ],
      textBtn: [
        tagTrial,
        `${tagReq}.${stageTrial}`,
        "text-button",
        tagModeGame,
        tagNameTask,
      ],
      keyAudio: [tagTrial, tagReq, stageTrial, tagModeGame, tagNameTask],
    };
    paramsStage = fillTextKeyValuesDef(paramsStageIn);
  };

  const trialNoGlasses = () => {
    prepareParamsStage(StageTrial.NO_GLASSES);
    const paramsInstr = {
      ...paramsStage,
      text4: "",
      textExtra: "",
      keyImg: params.keyImgNoGlasses,
    };
    return t_instructionTech(paramsInstr);
  };

  const trialMeasureVd = () => {
    prepareParamsStage(StageTrial.MEASURE_VD);
    const paramsInstr = {
      ...paramsStage,
      text4: "",
      textExtra: "",
      keyImg: params.keyImgMeasureVd,
    };
    return t_instructionTech(paramsInstr);
  };

  // eslint-disable-next-line no-unused-vars
  const trialCenter = () => ({
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      prepareParamsStage(StageTrial.CENTER);
      return (
        mediaAssets.audio[paramsStage.keyAudio] ??
        mediaAssets.audio.sharedNullAudioAll
      );
    },
    prompt: () => {
      const html = htmlLayout(StageTrial.CENTER);
      return html;
    },
    keyboard_choices: () => [TypeKey.DUMMY],
    button_choices: () => [],
    button_html: () => "",
    trial_ends_after_audio: () => false,
    on_load: () => {
      const btn = document.getElementById("id-button");
      const callbackOnBtnPress = () => {
        jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
      };
      btn.addEventListener("click", callbackOnBtnPress);
      const elVideoView = document.getElementById("id-video");
      if (state.cameraStream) {
        elVideoView.srcObject = state.cameraStream;
      }
    },
  });

  const trialCalibrate = () => {
    let intervalMetricsRecord = null;
    let progress = 0;

    return {
      type: jsPsychAudioMultiResponse,
      stimulus: () => {
        prepareParamsStage(StageTrial.CALIBRATE);
        return (
          mediaAssets.audio[paramsStage.keyAudio] ??
          mediaAssets.audio.sharedNullAudioAll
        );
      },
      prompt: () => {
        const html = htmlLayout(StageTrial.CALIBRATE);
        return html;
      },
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [],
      button_html: () => "",
      trial_ends_after_audio: () => false,
      on_load: () => {
        // TODO: very-very important
        state.collectSnapshots = false; // TODO: should be true with proper setting

        const elVideoView = document.getElementById("id-video");
        if (state.cameraStream) {
          elVideoView.srcObject = state.cameraStream;
        }

        const recordMetrics = () => {
          if (progress < 100) {
            if (progress === 50) {
              coordsHeadMid = state.coordsHead;
            }
            if (state.metricsIris) {
              arrMetricsIris.push(state.metricsIris);
            }
            if (state.metricsHead) {
              arrMerticsHead.push(state.metricsHead);
            }
            progress += 1;
            document.getElementById(
              "id-progress-bar",
            ).style.width = `${progress}%`;
          } else {
            clearInterval(intervalMetricsRecord);
            intervalMetricsRecord = null;
            jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
          }
        };

        const resetRecordMetrics = () => {
          if (intervalMetricsRecord) {
            clearInterval(intervalMetricsRecord);
            intervalMetricsRecord = null;
          }
          et_stateResetOngoing();
          progress = 0;
          document.getElementById("id-progress-bar").style.width = "0";
        };

        resetRecordMetrics();
        et_videoInit();
        et_videoStart();
        state.faceMesh.onResults(vd_calibr_onResultsFaceMesh);
        state.continueProcessing = true;
        progress = 0;
        setTimeout(() => fm_fmRun(), ET.FM.TIMEOUT_START);
        const timeIntervalMetricsRecord = params.durCalibr / 100;
        setTimeout(() => {
          intervalMetricsRecord = setInterval(
            recordMetrics,
            timeIntervalMetricsRecord,
          );
        }, 1.2 * ET.FM.TIMEOUT_START);
      },
      on_finish: () => {
        state.continueProcessing = false;
        clearInterval(intervalMetricsRecord);
        et_videoPause();
        state.faceMesh.onResults(() => {});
        et_htApplyCalibr(arrMerticsHead, coordsHeadMid);
        et_vdApplyCalibr(params.vdCalibr, arrMetricsIris);
      },
    };
  };

  const trialFinish = () => {
    const log = () => {
      document.getElementById("id-log").innerText = JSON.stringify(
        state.cal,
        null,
        2,
      );
    };

    prepareParamsStage(StageTrial.FINISH);
    const paramsInstr = {
      ...paramsStage,
      text4: "",
      textExtra: "",
      modeGameSkipResponse: ModeGame.ALL,
      // TODO: temp
      showLog: true,
      on_load_ext: log,
    };
    return t_instructionTech(paramsInstr);
  };

  return {
    timeline: [
      trialNoGlasses(),
      trialMeasureVd(),
      // trialCenter(),
      trialCalibrate(),
      t_et_stateSave({
        idTrialSaveOrFn: tagTrialVdCalibr,
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.NONE,
        requestUpload: false,
      }),
      trialFinish(),
    ],
    conditional_function: () =>
      sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.VD_CALIBRATE),
  };
};

// ============================================================
//  PLAYGROUND
// ============================================================

// TODO: NOTE: IMPORTANT: here canvasWork is FOR VISUALIZATION ONLY
// images for FaceMesh are coming from videoIn
export function ht_calibrPlayground_onResultsFaceMesh(resFm) {
  vd_calibr_onResultsFaceMesh(resFm);

  const drawCentroid = false;

  // eslint-disable-next-line prefer-destructuring
  const {
    canvasWork,
    widthImg,
    heightImg,
    coordsHead,
    coordsEyeL,
    coordsIrisR,
    coordsIrisL,
    coordsEyeR,
  } = state;
  canvasWork.width = widthImg;
  canvasWork.height = heightImg;

  const contextCanvasWork = canvasWork.getContext("2d");
  contextCanvasWork.save();
  contextCanvasWork.clearRect(0, 0, widthImg, heightImg);

  if (state.cal.ht.coordsHead) {
    fm_drawContour(
      state.cal.ht.coordsHead,
      widthImg,
      heightImg,
      canvasWork,
      true,
      "rgb(225,225,225)",
      "rgb(225, 225, 225)",
    );
    if (drawCentroid) {
      const centroidCalibr = fm_calcCentroid(state.cal.ht.coordsHead);
      fm_drawPoint(
        centroidCalibr[0],
        centroidCalibr[1],
        widthImg,
        heightImg,
        canvasWork,
        "rgb(175, 175, 175)",
        10,
      );
    }
  }

  fm_drawContour(
    state.coordsHead,
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "rgba(146,166,251,0.7)",
  );
  if (drawCentroid) {
    const centroidHead = fm_calcCentroid(coordsHead);
    fm_drawPoint(
      centroidHead[0],
      centroidHead[1],
      widthImg,
      heightImg,
      canvasWork,
      "rgb(146,166,251)",
      10,
    );
  }

  fm_drawBB(
    coordsEyeL[0][0],
    coordsEyeL[1][1],
    coordsEyeL[2][0],
    coordsEyeL[3][1],
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "rgb(250, 150, 0)",
  );
  fm_drawBB(
    coordsEyeR[0][0],
    coordsEyeR[1][1],
    coordsEyeR[2][0],
    coordsEyeR[3][1],
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "rgb(250, 150, 0)",
  );
  fm_drawContour(
    coordsEyeL,
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "rgb(250, 225, 0)",
  );
  fm_drawContour(
    coordsEyeR,
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "rgb(250, 225, 0)",
  );
  fm_drawContour(
    coordsIrisL,
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "#f700d2",
  );
  fm_drawContour(
    coordsIrisR,
    widthImg,
    heightImg,
    canvasWork,
    true,
    "blue",
    "#f700d2",
  );

  const typeMoveToCenter = typeMoveHeadToCenter(
    coordsHead,
    coordsEyeL,
    coordsEyeR,
  );
  const elMoveHead = document.getElementById("id-move-head");
  const elMsgSaveMetrics = document.getElementById("id-msg-save-metrics");
  if (elMoveHead && elMsgSaveMetrics) {
    if (typeMoveToCenter === TypeMoveHead.NONE) {
      elMoveHead.innerHTML = `<h3 style="color: #00bb00; background-color:yellow">head centered</h3>`;
    } else {
      elMoveHead.innerHTML = `<h3 style="color: red; background-color: yellow">${typeMoveToCenter.replace(
        "-",
        " head ",
      )}</h3>`;
    }
  }
  contextCanvasWork.restore();

  const flNormCur = parseFloat(document.getElementById("id-input-nfl")?.value);

  if (flNormCur) {
    const vdCur = et_vdCalcVd(
      state.metricsIris.widthIrisL,
      state.metricsIris.widthIrisR,
      flNormCur,
      widthImg,
      heightImg,
    );
    document.getElementById("id-dist-abs").textContent = vdCur.toFixed(0);

    if (state.cal.vdCalibrated) {
      const vdCalibr = state.cal.vd.vd;
      const ratioDistView = vdCur / vdCalibr;
      document.getElementById("id-dist-rel").textContent = (
        100 * ratioDistView
      ).toFixed(0);
    }
    state.vdCur = vdCur;
  }
}

const paramsHtCalibrPlaygroundDef = {
  heightCanvas: 50,
  durCalibr: ET.HT.DUR_CALIBR,
};

export const t_et_htCalibrPlayground = (
  paramsIn = {} /* viewingDistance */,
) => {
  let params = null;

  const trialCalibration = {
    type: jsPsychAudioButtonResponse,
    trial_ends_after_audio: false,
    response_allowed_while_playing: false,

    stimulus: () => mediaAssets.audio.roavMpNullAudioAll,
    prompt: () => {
      const widthCanvas = (params.heightCanvas * 1920) / 1080;
      // const configDevice = store.session.get("configDevice") ?? defaultDeviceConfig;
      return `
        <style>
          #jspsych-audio-button-response-btngroup { position: absolute; bottom: 5vh; left: 50%; transform: translateX(-50%); }
          .jspsych-display-element .jspsych-btn { font-size: 3vh; }
          #id-input-nfl-wrap { position: fixed; top: 10px; right: 10px; width: 15vw; height: calc(100vh - 40px); border: 1px solid black; text-align: left; font-size: 1.5vh; padding: 10px; }
        </style>
        <div id="id-input-nfl-wrap">
          <h3>IMPORTANT</h3>
          <p>Enter <b>normalized focal length</b> of your camera.</p>
          <p>Without it, we cannot determine absolute viewing distance.</p>
          <br><br>
          <label><b>Normalized focal length</b></label>
          <br><br>
          <input id="id-input-nfl" type="number" step="0.01" min="0.1" max="3" value="${
            state.cal.vd.flNorm ?? ET.FL_NORM_DEF
          }" 
            style="width:6ch; font-size: 1.17em; font-weight: bold; color: rgba(76, 101, 139, 1);">
          <br>
          <hr>
          <br><br>
          <label><b>Estimated viewing distance</b></label>
          <br><br>
          <label>Absolute (cm)</label>
          <br><br>
          <h3 id="id-dist-abs" style="background-color: yellow"></h3>
          <br><br>
          <label>Relative to saved metrics (%)</label>
          <br><br>
          <h3 id="id-dist-rel"></h3>
          <br><br>
          <label><b>Saved metrics</b></label>
          <br><br>
          <div id="id-config-calibr">Not saved yet</div>
        </div>
        <div style="text-align: center; margin-top: -15vh">
          <h3>Head and Distance Tracking</h3>
          <div id="id-msg-save-metrics"></div>
          <div id="id-move-head"></div>
          <div style="width:${widthCanvas}vh; height:${
            params.heightCanvas
          }vh; margin:0 auto;">
            <canvas id="id-canvas-work" style="width:100%; height:100%; border:1px solid black;"></canvas>
          </div>
        </div>`;
    },
    choices: ["NEXT"],
    on_load: () => {
      state.canvasWork = document.getElementById("id-canvas-work");
      et_videoInit();
      et_videoStart();
      state.faceMesh.onResults(ht_calibrPlayground_onResultsFaceMesh);
      state.continueProcessing = true;
      setTimeout(() => fm_fmRun(), ET.FM.TIMEOUT_START);
    },
    on_start: () => {},
    on_finish: () => {
      state.continueProcessing = false;
      // et_videoStop();
      et_videoPause();
      state.faceMesh.onResults(() => {});
    },
  };

  return {
    timeline: [trialCalibration],
    on_timeline_start: () => {
      params = { ...paramsHtCalibrPlaygroundDef, ...paramsIn };
    },
  };
};
