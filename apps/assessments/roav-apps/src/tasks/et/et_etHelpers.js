/* eslint-disable no-underscore-dangle */
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import { PolynomialRegression } from "ml-regression-polynomial";
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../shared/helpers/mediaAssets";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";
import { ET } from "./et_constants";
import {
  model_prepareInput,
  model_xyModel,
  model_xyModelToPred,
  model_xyPredToPredPx,
} from "./et_etModelHelpers";
import { jsPsych } from "../shared/helpers/taskSetup";
// import "./eyetracking_google.onnx";  // @ONNX-FIX
import {
  fm_def_beforeSendToFm,
  fm_def_fillStateOnResultsFm,
} from "./et_fmHelpers";
import {
  et_paramsSnapsotDef,
  et_stateResetCalTarg,
  et_stateResetOngoing,
  et_stateResetSnapshots,
  et_TypeSaveSnapshots,
  state,
  t_et_stateSave,
} from "./et_state";
import {
  et_videoInit,
  et_videoPause,
  et_videoStart,
  et_videoRecordStart,
  t_et_videoRecordSave,
  et_videoValid,
  t_et_videoRecordStart,
} from "./et_videoHelpers";
import { ht_def_fillStateOnResultsFm } from "./et_htHelpers";
import {
  AssessmentStage,
  fillTextKeyValuesDef,
  TAG_REQ_DEF,
  TypeKey,
} from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";
import { degToPxFromWidth, UnitSize } from "../shared/helpers/unitsHelper";

// WARNINGS:
// - ET calibration - should calibrate from resFm.image (FM) not from video that might have advanced (crops according to face mesh but image from video)
// - uses screen.height instead of window.innerWidth to calculate transform between model & prediction

export const et_TypeDecor = {
  NONE: "none",
  STRIPES_LR: "stripes-lr",
};

export const et_paramsDecorDef = {
  typeDecor: et_TypeDecor.STRIPES_LR,
  widthStripe: 5, // % of window width // @THINK maybe should be on % of screen width?
  clrStripe: "#0000ff",
};

export const et_paramsLayoutDef = {
  showEyes: true,
  showGaze: sessionGet(SK.SHOW_GAZE),
  createCanvasNative: false,
};

const DEG_AVER = 5;

export function et_etCreateDecor(paramsDecorIn) {
  const configEt = sessionGet(SK.CONFIG_ET);
  const paramsDecorConfig = configEt?.paramsDecor;
  const paramsDecor = {
    ...et_paramsDecorDef,
    ...paramsDecorConfig,
    ...paramsDecorIn,
  };
  if (paramsDecor.typeDecor === et_TypeDecor.STRIPES_LR) {
    if (!document.getElementById("id-et-stripe-l")) {
      const elStripeL = document.createElement("div");
      elStripeL.id = "id-et-stripe-l";
      elStripeL.className = "et-stripe-l";
      elStripeL.style.width = `${paramsDecor.widthStripe}vw`;
      elStripeL.style.background = paramsDecor.clrStripe;
      document.body.appendChild(elStripeL);
    }
    if (!document.getElementById("id-et-stripe-r")) {
      const elStripeR = document.createElement("div");
      elStripeR.id = "id-et-stripe-r";
      elStripeR.className = "et-stripe-r";
      elStripeR.style.width = `${paramsDecor.widthStripe}vw`;
      elStripeR.style.background = paramsDecor.clrStripe;
      document.body.appendChild(elStripeR);
    }
  }
}

export function et_etCreateLayout(paramsIn) {
  const params = { ...et_paramsLayoutDef, ...paramsIn };
  params.paramsDecor = {
    ...et_paramsLayoutDef.paramsDecor,
    ...paramsIn.paramsDecor,
  };

  if (params.showGaze) {
    if (!state.elMarkGaze) {
      const elMarkGaze = document.createElement("div");
      elMarkGaze.id = "id-et-mark-gaze";
      elMarkGaze.className = "et-mark-gaze";
      document.body.appendChild(elMarkGaze);
      state.elMarkGaze = elMarkGaze;
    }
    state.elMarkGaze.style.display = params.showGaze ? "block" : "none";
  } else {
    state.elMarkGaze = null;
  }

  if (params.createCanvasNative && !state.canvasNativeEyeL) {
    state.canvasNativeEyeL = document.createElement("canvas");
    state.canvasNativeEyeL.id = "id-et-canvas-native-eye-l";
    state.canvasNativeEyeL.className = "et-canvas-eye";
  } else {
    state.canvasNativeEyeL = null;
  }

  if (!state.canvasScaledEyeL) {
    state.canvasScaledEyeL = document.createElement("canvas");
    state.canvasScaledEyeL.id = "id-et-canvas-scaled-eye-l";
    state.canvasScaledEyeL.className = "et-canvas-eye";
    state.canvasScaledEyeL.width = ET.ET.SIZE_IMG_EYE_MODEL;
    state.canvasScaledEyeL.height = ET.ET.SIZE_IMG_EYE_MODEL;
  }

  if (params.createCanvasNative && !state.canvasNativeEyeR) {
    state.canvasNativeEyeR = document.createElement("canvas");
    state.canvasNativeEyeR.id = "id-et-canvas-native-eye-r";
    state.canvasNativeEyeR.className = "et-canvas-eye";
  } else {
    state.canvasNativeEyeR = null;
  }

  if (!state.canvasScaledEyeR) {
    state.canvasScaledEyeR = document.createElement("canvas");
    state.canvasScaledEyeR.id = "id-et-canvas-scaled-eye-r";
    state.canvasScaledEyeR.className = "et-canvas-eye";
    state.canvasScaledEyeR.width = ET.ET.SIZE_IMG_EYE_MODEL;
    state.canvasScaledEyeR.height = ET.ET.SIZE_IMG_EYE_MODEL;
  }

  // @THINK: check mirroring
  if (params.showEyes) {
    document.body.appendChild(state.canvasScaledEyeL);
    document.body.appendChild(state.canvasScaledEyeR);
    if (state.canvasNativeEyeL) {
      document.body.appendChild(state.canvasNativeEyeL);
    }
    if (state.canvasNativeEyeR) {
      document.body.appendChild(state.canvasNativeEyeR);
    }
    const sizeCanvas = ET.ET.SIZE_IMG_EYE_MODEL;
    state.canvasScaledEyeL.style.top = 0;
    state.canvasScaledEyeL.style.left = 0;
    state.canvasScaledEyeL.style.transform = "scaleX(-1)";

    state.canvasScaledEyeR.style.top = 0;
    state.canvasScaledEyeR.style.left = `${sizeCanvas}px`;
    state.canvasScaledEyeR.style.transform = "scaleX(-1)";

    if (state.canvasNativeEyeL) {
      state.canvasNativeEyeL.style.top = `${sizeCanvas}px`;
      state.canvasNativeEyeL.style.left = 0;
      state.canvasNativeEyeL.style.transform = "scaleX(-1)";
    }

    if (state.canvasNativeEyeR) {
      state.canvasNativeEyeR.style.top = `${sizeCanvas}px`;
      state.canvasNativeEyeR.style.left = `${sizeCanvas}px`;
      state.canvasNativeEyeR.style.transform = "scaleX(-1)";
    }
  }
}

export const et_etRemoveDecor = () => {
  document.getElementById("id-et-stripe-l")?.remove();
  document.getElementById("id-et-stripe-r")?.remove();
};

export const et_etRemoveLayout = () => {
  if (state.canvasScaledEyeL) {
    state.canvasScaledEyeL.remove();
    state.canvasScaledEyeL = null;
  }
  if (state.canvasNativeEyeL) {
    state.canvasNativeEyeL.remove();
    state.canvasNativeEyeL = null;
  }
  if (state.canvasScaledEyeR) {
    state.canvasScaledEyeR.remove();
    state.canvasScaledEyeR = null;
  }
  if (state.canvasNativeEyeR) {
    state.canvasNativeEyeR.remove();
    state.canvasNativeEyeR = null;
  }
  if (state.elMarkGaze) {
    state.elMarkGaze.remove();
    state.elMarkGaze = null;
  }
};

// @THINK: make sure that images of left and right eyes and (-1) transform are correct input to the model

// eslint-disable-next-line no-unused-vars
export const et_def_onResultsModel = (resModel, params = {}) => {
  state.xyModel = model_xyModel(resModel);
  state.xyPred = model_xyModelToPred(state.xyModel, state.cal.et);
  state.xyPredPx = model_xyPredToPredPx(state.xyPred);
  if (state.elMarkGaze) {
    state.elMarkGaze.style.left = `${state.xyPredPx.x}px`;
    state.elMarkGaze.style.top = `${state.xyPredPx.y}px`;
  }
};

export function et_def_onResultsFaceMesh(resFm) {
  if (!resFm.multiFaceLandmarks) {
    return;
  }
  fm_def_fillStateOnResultsFm(resFm);
  ht_def_fillStateOnResultsFm();
}

let iterationRunning = false;

async function et_etRunIteration() {
  if (iterationRunning) {
    // eslint-disable-next-line no-console
    console.warn("ET: duplicate chain detected");
    return; // @@@NEW
  }
  iterationRunning = true;

  const { faceMesh, videoIn } = state;

  if (!faceMesh || !et_videoValid(videoIn)) {
    if (state.continueProcessing) {
      // setTimeout(et_etRunIteration, ET.ET.TIMEOUT_MODEL_RETRY);  // @@@NEW
      setTimeout(() => {
        iterationRunning = false;
        et_etRunIteration();
      }, ET.ET.TIMEOUT_MODEL_RETRY); // @@@NEW
    } else {
      iterationRunning = false; // @@@NEW
    }
    return;
  }

  fm_def_beforeSendToFm();
  await faceMesh.send({ image: videoIn });
  if (!state.continueProcessing) {
    iterationRunning = false;
    return;
  }

  if (!state.workerONNX) {
    // ET not requested, only FM + vd estimates
    if (state.continueProcessing) {
      // setTimeout(et_etRunIteration, state.timeoutFm);  // @@@NEW
      setTimeout(() => {
        iterationRunning = false;
        et_etRunIteration();
      }, state.timeoutFm); // @@@NEW
    }
  } else {
    try {
      if (!state.coordsEyeL || !state.coordsEyeR) {
        throw new Error("ET: no face detected");
      }
      const inputModel = model_prepareInput();
      // state.workerONNX.postMessage(inputModel); // rewrite for safari
      state.workerONNX.postMessage(inputModel, [
        inputModel.input1.data.buffer,
        inputModel.input2.data.buffer,
        inputModel.kpsTensor.data.buffer,
      ]);
    } catch (error) {
      if (state.continueProcessing) {
        // setTimeout(et_etRunIteration, ET.ET.TIMEOUT_MODEL_RETRY); // @@@NEW
        setTimeout(() => {
          iterationRunning = false;
          et_etRunIteration();
        }, ET.ET.TIMEOUT_MODEL_RETRY); // @@@NEW
      }
    }
  }
  // iterationRunning = false;        // @@@NEW
}

// assumes that state.faceMesh is already initialized
export const et_etInit = (
  onResultsFaceMesh = et_def_onResultsFaceMesh,
  onResultsModel = et_def_onResultsModel, // = null if want FM only
) => {
  et_stateResetOngoing(true);

  state.continueProcessing = true;

  state.faceMesh.onResults(onResultsFaceMesh);

  if (!onResultsModel) {
    if (state.workerONNX) {
      state.workerONNX.terminate();
    }
    state.workerONNX = null;
  } else {
    if (!state.workerONNX) {
      state.workerONNX = new Worker(
        new URL("./et_worker.js", import.meta.url),
        {
          type: "module",
        },
      );
    }

    state.workerONNX.onmessage = (e) => {
      if (e.data.error) {
        // eslint-disable-next-line no-console
        console.error("ET: error from worker:", e.data.error);
      } else {
        onResultsModel(e.data);
      }
      //       if (state.continueProcessing) {
      //        setTimeout(et_etRunIteration, state.timeoutModel);
      //      }       // @@@NEW
      if (state.continueProcessing) {
        // @@@NEW
        setTimeout(() => {
          iterationRunning = false;
          et_etRunIteration();
        }, state.timeoutModel);
      } else {
        iterationRunning = false;
      }
    };
  }
};

export function et_etStop() {
  state.continueProcessing = false;

  if (state.faceMesh.onResults) {
    state.faceMesh.onResults(() => {});
  }
}

export const et_etStart = () => {
  if (!iterationRunning) {
    et_etRunIteration();
  }
};

export const et_etSetupInitStartSimple = (
  paramsEt,
  collectSnapshots,
  paramsSnapshots,
  onResultsModel = et_def_onResultsModel,
) => {
  et_stateResetOngoing();
  et_stateResetSnapshots();
  state.collectSnapshots = collectSnapshots;
  state.paramsSnapshot = {
    ...et_paramsSnapsotDef,
    ...paramsSnapshots
  };
  state.timeoutFm = paramsEt?.timeoutFm ?? ET.FM.TIMEOUT_FM_DEF;
  state.timeoutModel = paramsEt?.timeoutModel ?? ET.ET.TIMEOUT_MODEL_DEF;

  let startEt = false;
  if (paramsEt.runFm) {
    if (paramsEt.runModel) {
      et_etInit(et_def_onResultsFaceMesh, onResultsModel);
      startEt = true;
    } else {
      et_etInit(et_def_onResultsFaceMesh, null);
      startEt = true;
    }
  }

  if (startEt) {
    if (!state.videoIn) {
      // may happen if the calibrations are skipped
      et_videoInit();
    }
    et_videoStart();
    et_etStart();
  }
};

export const et_etWorkerPreload = () => {
  if (!state.workerONNX) {
    state.workerONNX = new Worker(new URL("./et_worker.js", import.meta.url), {
      type: "module",
    });
    state.workerONNX.onmessage = () => {};
  }
};

export const t_et_etWorkerPreload = () => ({
  type: jsPsychCallFunction,
  func: () => et_etWorkerPreload(),
});

export const et_etWorkerStopFull = () => {
  if (state.workerONNX) {
    state.workerONNX.terminate();
    state.workerONNX = null;
  }
};

export const t_et_etWorkerStopFull = () => ({
  type: jsPsychCallFunction,
  func: () => et_etWorkerStopFull(),
});

const tagTrialEtCalibr = "et-calibr";
export const et_TypeMove = {
  CONST: "const",
  ZIGZAG: "zigzag",
  CENTER_SIDE: "center-side",
};

export const et_TypeShift = {
  HOR_ONLY: "hor-only",
  VERT_ONLY: "vert-only",
  HOR_VERT: "hor-vert",
  RANDOM: "random",
};

// @THINK: pay attention to the choice of calibration points (such as 65 vs. 75)
export const et_paramsCalibrDef = (tagReq = TAG_REQ_DEF) => ({
  enabled: true,
  idCalibr: "none",
  typeMove: et_TypeMove.CONST,
  moveSmooth: false,
  tagReq: tagReq,
  showLog: false,
  playAudio: false,
  keyAudioInstrPre: [tagTrialEtCalibr, tagReq, "instr-pre"],
  keyAudioCalibr: [tagTrialEtCalibr, tagReq, "calibr"],
  srcMarkFix: null,
  sizeMarkFix: 25, // pixels - sub-optimal, but OK at least for now
  classAnimFix: "et-calibr-animation-rotate",
  showBurstGap: true,
  classAnimGap: "", // takes precedence over burst
  playAudioGap: true,
  keyAudioGap: "sharedAudioChimeAll",
  _locsFix: [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 25, y: 65 },
    { x: 75, y: 65 },
  ],
  locsFix: null,
  durFix: 3000,
  durDiscardFixStart: 1000,
  durDiscardFixEnd: 100,
  durGap: 800,

  // recording quality
  videoBitsPerSecond: null,

  // params for creating movement patterns
  vdCm: null,
  widthScreenCm: null,
  widthScreenPx: null,
  heightScreenPx: null,

  unitSectionWidth: UnitSize.PERCENT_WIDTH,
  unitSectionHeight: UnitSize.PERCENT_HEIGHT,
  unitShiftX: UnitSize.DEG,
  unitShiftY: UnitSize.DEG,
  numSection: 3,
  indSection: null, // set it if you want a specific section instead of all sections together
  _widthSection: 30,
  _heightSection: 90,
  widthSection: null,
  heightSection: null,
  durSection: null,

  useSlope: false,
  slopeMin: 0,
  slopeMax: 1,
  _xShiftMin: 2,
  _xShiftMax: 8,
  _yShiftMin: 0,
  _yShiftMax: 3,
  xShiftMin: null,
  xShiftMax: null,
  yShiftMin: null,
  yShiftMax: null,
  resetSlopeAtEveryMove: false,
  resetShiftAtEveryMove: false,
  resetYAtEverySegment: false,
  pxPerDegAver: null,

  // typeMove = CENTER_SIDE
  _xCenter: 50,
  _yCenter: 40,
  xCenter: null,
  yCenter: null,
  typeShift: et_TypeShift.HOR_ONLY,
  unitCenterX: UnitSize.PERCENT_WIDTH,
  unitCenterY: UnitSize.PERCENT_HEIGHT,

  // visual extras
  showGaze: false,
  showEyes: false,
  paramsDecor: null,
  paramsSnapshot: null,
  keepDecorOnFinish: false, // keep decor to prevent flickering between trials

  isCalibrCollect: false,
  applyCalibr: true,
});

const et_htmlMarkFix = (srcMarkFix, widthMarkFix) => {
  let classMarkFix = "et-mark-fix ";
  if (!srcMarkFix) {
    classMarkFix += "et-mark-fix-def";
  }
  const styleMarkFix = `width:${widthMarkFix}px`;
  const idMarkFix = "id-et-mark-fix";

  let html = "";
  if (srcMarkFix) {
    html = `<img src="${srcMarkFix}" 
      id="${idMarkFix}" 
      class="${classMarkFix}" 
      style="${styleMarkFix}">`;
  } else {
    html = `<div 
      id="${idMarkFix}" 
      class="${classMarkFix}"
      style="${styleMarkFix}">
    </div>`;
  }

  return html;
};

const et_createBurstEffect = (x, y, sizeMarkFix, sizeBurst, durBurst) => {
  const numShape = 8;
  const container = document.createElement("div");
  document.body.appendChild(container);

  for (let iShape = 0; iShape < numShape; iShape += 1) {
    const elBurst = document.createElement("div");
    elBurst.classList.add(
      "et-calibr-burst-circle",
      "et-calibr-animation-burst",
    );
    elBurst.style.animationDuration = `${durBurst}ms`;
    elBurst.style.left = `${x - sizeMarkFix / 2}px`;
    elBurst.style.top = `${y - sizeMarkFix / 2}px`;
    elBurst.style.setProperty(
      "--dx",
      `${Math.cos((iShape / numShape) * Math.PI * 2) * sizeBurst}px`,
    );
    elBurst.style.setProperty(
      "--dy",
      `${Math.sin((iShape / numShape) * Math.PI * 2) * sizeBurst}px`,
    );
    container.appendChild(elBurst);
  }

  setTimeout(() => container.remove(), durBurst);
};

const et_calibrFilterSamples = (
  timesStartFm,
  durDiscardFixStart,
  durDiscardFixEnd,
) => {
  const intervalsUseForCalibr = [];
  const { timesStartFix, dursFix } = state.calFix;
  for (let iFix = 0; iFix < timesStartFix.length; iFix += 1) {
    intervalsUseForCalibr.push([
      timesStartFix[iFix] + durDiscardFixStart,
      timesStartFix[iFix] + dursFix[iFix] - durDiscardFixEnd,
    ]);
  }
  const useForCalibr = [];
  for (let iSampleFm = 0; iSampleFm < timesStartFm.length; iSampleFm += 1) {
    const timeStartFm = timesStartFm[iSampleFm];
    const use = intervalsUseForCalibr.some(
      ([timeAnimStartInterval, timeEndInterval]) =>
        timeStartFm >= timeAnimStartInterval && timeStartFm <= timeEndInterval,
    );
    useForCalibr.push(use);
  }
  return useForCalibr;
};

const et_applyCalibr = (arrPred, arrTarg) => {
  state.cal.etCalibrated = false;
  if (arrPred.length < 2) {
    // eslint-disable-next-line no-console
    console.warn("ET: not enough calibration samples:", arrPred.length);
    return;
  }
  const xxPred = arrPred.map((val) => val.x);
  const yyPred = arrPred.map((val) => val.y);
  const xxFix = arrTarg.map((val) => val.x);
  const yyFix = arrTarg.map((val) => val.y);

  const xRegr = new PolynomialRegression(xxPred, xxFix, 1);
  const yRegr = new PolynomialRegression(yyPred, yyFix, 1);

  const calibrEt = {
    xCoeff: xRegr.coefficients[1],
    xIntercept: xRegr.coefficients[0],
    yCoeff: yRegr.coefficients[1],
    yIntercept: yRegr.coefficients[0],
  };
  state.cal.et = calibrEt;
  state.cal.etCalibrated = true;
};

export const t_et_etCalibr = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params = null;
  let audioGapBuffer = null;

  const arrXyTargFm = [];
  const arrXyPredFm = [];
  const arrTimeStartFm = [];

  let elMarkFix = null;

  const fillLocsFix = () => {
    params.locsFix = [];
    params.pxPerDegAver =
      degToPxFromWidth(
        DEG_AVER,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      ) / DEG_AVER;
    const percPerDegHor = (100 * params.pxPerDegAver) / params.widthScreenPx;
    const percPerDegVert = (100 * params.pxPerDegAver) / params.heightScreenPx;

    if (params.unitSectionWidth === UnitSize.PERCENT_WIDTH) {
      params.widthSection = params._widthSection;
    } else if (params.unitSectionWidth === UnitSize.DEG) {
      params.widthSection = params._widthSection * percPerDegHor;
    }
    if (params.unitSectionHeight === UnitSize.PERCENT_HEIGHT) {
      params.heightSection = params._heightSection;
    } else if (params.unitSectionHeight === UnitSize.DEG) {
      params.heightSection = params._heightSection * percPerDegVert;
    }
    if (params.unitShiftX === UnitSize.PERCENT_WIDTH) {
      params.xShiftMin = params._xShiftMin;
      params.xShiftMax = params._xShiftMax;
    } else if (params.unitShiftX === UnitSize.DEG) {
      params.xShiftMin = params._xShiftMin * percPerDegHor;
      params.xShiftMax = params._xShiftMax * percPerDegHor;
    }
    if (params.unitShiftY === UnitSize.PERCENT_HEIGHT) {
      params.yShiftMin = params._yShiftMin;
      params.yShiftMax = params._yShiftMax;
    } else if (params.unitShiftY === UnitSize.DEG) {
      params.yShiftMin = params._yShiftMin * percPerDegVert;
      params.yShiftMax = params._yShiftMax * percPerDegVert;
    }

    if (params.unitCenterX === UnitSize.PERCENT_WIDTH) {
      params.xCenter = params._xCenter;
    }
    if (params.unitCenterY === UnitSize.PERCENT_HEIGHT) {
      params.yCenter = params._yCenter;
    }

    if (params.typeMove === et_TypeMove.CONST) {
      params.locsFix = params._locsFix;
    } else if (params.typeMove === et_TypeMove.ZIGZAG) {
      const {
        numSection,
        indSection,
        widthSection,
        heightSection,
        durSection,
        durFix,
        useSlope,
        slopeMin,
        slopeMax,
        xShiftMin,
        xShiftMax,
        yShiftMin,
        yShiftMax,
        resetSlopeAtEveryMove,
        resetShiftAtEveryMove,
        resetYAtEverySegment,
      } = params;

      const numFix = Math.floor(durSection / durFix);
      const slopeRandom = () =>
        slopeMin + Math.random() * (slopeMax - slopeMin);
      const xShiftRandom = () =>
        xShiftMin + Math.random() * (xShiftMax - xShiftMin);
      const yShiftRandom = () =>
        yShiftMin + Math.random() * (yShiftMax - yShiftMin);

      const marginHor = (100 - numSection * widthSection) / 2;
      const marginVert = (100 - heightSection) / 2;

      for (let iSection = 0; iSection < numSection; iSection += 1) {
        if (indSection !== null) {
          if (iSection !== indSection) {
            // eslint-disable-next-line no-continue
            continue;
          }
        }
        const xMin = marginHor + iSection * widthSection;
        const xMax = xMin + widthSection;
        const yMin = marginVert;
        const yMax = yMin + heightSection;

        let x = xMin + Math.random() * (xMax - xMin);
        let y = yMin + Math.random() * (yMax - yMin);

        let xShift = xShiftRandom();
        let yShift = yShiftRandom();
        let slope = slopeRandom();

        const locsSection = [];
        for (let iFix = 0; iFix < numFix; iFix += 1) {
          if (resetShiftAtEveryMove) {
            xShift = Math.sign(xShift) * xShiftRandom();
            yShift = Math.sign(yShift) * yShiftRandom();
          }
          if (resetSlopeAtEveryMove) {
            slope = Math.sign(slope) * slopeRandom();
          }

          x += xShift;
          y += useSlope ? slope * Math.abs(xShift) : yShift;

          if (x > xMax) {
            x = xMax;
            xShift = -xShiftRandom();
            if (resetYAtEverySegment) y = yMin + Math.random() * (yMax - yMin);
          }
          if (x < xMin) {
            x = xMin;
            xShift = xShiftRandom();
            if (resetYAtEverySegment) y = yMin + Math.random() * (yMax - yMin);
          }
          if (y > yMax) {
            y = yMax;
            slope = -slopeRandom();
            yShift = -yShiftRandom();
          }
          if (y < yMin) {
            y = yMin;
            slope = slopeRandom();
            yShift = yShiftRandom();
          }

          locsSection.push({ x, y });
        }

        params.locsFix.push(...locsSection);
      }
    } else if (params.typeMove === et_TypeMove.CENTER_SIDE) {
      const {
        numSection,
        indSection,
        xCenter,
        yCenter,
        xShiftMin,
        xShiftMax,
        yShiftMin,
        yShiftMax,
        durSection,
        durFix,
      } = params;

      const numFix = Math.floor(durSection / durFix);

      for (let iSection = 0; iSection < numSection; iSection += 1) {
        if (indSection !== null && iSection !== indSection) {
          // eslint-disable-next-line no-continue
          continue;
        }
        for (let iFix = 0; iFix < numFix; iFix += 1) {
          if (iFix % 2 === 0) {
            params.locsFix.push({ x: xCenter, y: yCenter });
          } else {
            const xSign = Math.random() < 0.5 ? -1 : 1;
            const ySign = Math.random() < 0.5 ? -1 : 1;
            let xShiftRes =
              xSign * (xShiftMin + Math.random() * (xShiftMax - xShiftMin));
            let yShiftRes =
              ySign * (yShiftMin + Math.random() * (yShiftMax - yShiftMin));

            if (params.typeShift === et_TypeShift.HOR_ONLY) {
              yShiftRes = 0;
            } else if (params.typeShift === et_TypeShift.VERT_ONLY) {
              xShiftRes = 0;
            } else if (params.typeShift === et_TypeShift.HOR_VERT) {
              const xyRand = Math.random();
              if (xyRand < 0.5) {
                yShiftRes = 0;
              } else {
                xShiftRes = 0;
              }
            } else if (params.typeShift === et_TypeShift.RANDOM) {
              /* default */
            }

            params.locsFix.push({
              x: xCenter + xShiftRes,
              y: yCenter + yShiftRes,
            });
          }
        }
      }
    }
  };

  const prepareAudio = () => {
    audioGapBuffer = null;
    if (
      params.durGap > 0 &&
      params.playAudioGap &&
      mediaAssets.audio[params.keyAudioGap]
    ) {
      jsPsych.pluginAPI
        .getAudioBuffer(mediaAssets.audio[params.keyAudioGap])
        .then((buffer) => {
          audioGapBuffer = buffer;
        })
        // eslint-disable-next-line no-console
        .catch((e) => console.warn("audio gap: failed to prepare buffer: ", e));
    }
  };

  const playAudioGapBuffer = () => {
    try {
      const ctx = jsPsych.pluginAPI.audioContext();
      const src = ctx.createBufferSource();
      src.buffer = audioGapBuffer;
      src.connect(ctx.destination);
      src.start();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("audio gap: failed to play: ", e);
    }
  };

  const prepareParams = () => {
    // eslint-disable-next-line no-param-reassign
    paramsIn.tagReq ??= tagReq;

    params = {
      ...fillTextKeyValuesDef(et_paramsCalibrDef(paramsIn.tagReq)),
      ...fillTextKeyValuesDef(paramsIn),
    };
    params.vdCm ??= state.cal.vd.vd;
    params.widthScreenCm ??= state.cal.screen.widthCm;
    params.widthScreenPx ??= state.cal.screen.widthPx;
    params.heightScreenPx ??= sessionGet(SK.HEIGHT_WINDOW_FS);

    fillLocsFix();
    // console.log("DEBUG fillLocsFix:", JSON.stringify(params, null, 2));
  };

  const et_calibr_onResultsModel = (resModel) => {
    arrXyTargFm.push(state.xyTargFm);
    state.xyModel = model_xyModel(resModel);
    state.xyPred = model_xyModelToPred(state.xyModel);
    arrXyPredFm.push(state.xyPred);
    arrTimeStartFm.push(state.timeStartFm);
  };

  const runMarkFixCalibr = (xLoc, yLoc) => {
    elMarkFix.style.left = `${xLoc}%`;
    elMarkFix.style.top = `${yLoc}%`;
    elMarkFix.style.visibility = "visible";
    if (params.classAnimGap) {
      elMarkFix.classList.remove(params.classAnimGap);
    }
    elMarkFix.classList.add(params.classAnimFix);

    state.xyTarg = { x: xLoc, y: yLoc };

    if (params.durGap > 0) {
      if (params.playAudioGap && audioGapBuffer) {
        setTimeout(playAudioGapBuffer, params.durFix);
      }

      if (params.showBurstGap) {
        setTimeout(() => {
          elMarkFix.style.visibility = "hidden";
          const xPx = (xLoc / 100) * window.innerWidth;
          const yPx = (yLoc / 100) * window.innerHeight;
          et_createBurstEffect(
            xPx,
            yPx,
            params.sizeMarkFix,
            2 * params.sizeMarkFix,
            params.durGap,
          );
        }, params.durFix);
      } else if (params.classAnimGap && params.classAnimGap !== "") {
        setTimeout(() => {
          elMarkFix.classList.remove(params.classAnimFix);
          elMarkFix.classList.add(params.classAnimGap);
        }, params.durFix);
      }
    }
  };

  const htmlLayout = () => {
    const htmlMarkFix = et_htmlMarkFix(params.srcMarkFix, params.sizeMarkFix);
    const html = `
      ${htmlMarkFix}
    `;
    return html;
  };

  // conditional on audio not being null
  const trialInstrPre = {
    type: jsPsychAudioMultiResponse,
    stimulus: () =>
      mediaAssets.audio[params.keyAudioInstrPre] ??
      mediaAssets.audio.sharedNullAudioAll,
    prompt: () => "",
    on_load: () => et_etCreateDecor(params.paramsDecor),
    on_finish: () => et_etRemoveDecor(),
    keyboard_choices: () => [],
    button_choices: () => [],
    button_html: () => "",
    trial_ends_after_audio: () => true,
  };

  // eslint-disable-next-line arrow-body-style
  const trialCalibrate = () => {
    return {
      type: jsPsychAudioMultiResponse,
      stimulus: () =>
        mediaAssets.audio[params.keyAudioCalibr] ??
        mediaAssets.audio.sharedNullAudioAll,
      prompt: () => htmlLayout(),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [],
      button_html: () => "",
      trial_ends_after_audio: () => false,
      on_load: () => {
        const configEt = sessionGet(SK.CONFIG_ET);
        const collectSnapshots = params.isCalibrCollect
          ? configEt?.saveSnapshotsCalibrCollect
          : configEt?.saveSnapshotsCalibr;
        const paramsConfig = params.isCalibrCollect
          ? configEt?.paramsSnapshotCalibrCollect
          : configEt?.paramsSnapshotCalibr;
        const paramsEt = params.isCalibrCollect
          ? configEt?.paramsEtCalibrCollect
          : configEt?.paramsEtCalibr;

        et_etCreateLayout({
          showGaze: params.showGaze,
          showEyes: params.showEyes,
        });
        et_etCreateDecor(params.paramsDecor);

        et_videoInit();

        // @@@NEW
        /* 
        et_etSetupInitStartSimple(
          paramsEt,
          collectSnapshots ?? false,
          paramsConfig,
          et_calibr_onResultsModel,
        );
        */

        elMarkFix = document.getElementById("id-et-mark-fix");

        et_stateResetCalTarg();
        state.calFix.params = { ...params, locsFix: null };
        state.calFix.timeAnimStartFixFirst = Date.now();

        // @THINK - do not delete quite yet - smoother interpolation with different mechanics
        /*
        if (params.moveSmooth) {
          let timeAnimStart = null;
          const durStep = params.durFix + params.durGap;
          const durTotal = params.locsFix.length * durStep;
          let iLocCur = -1;

          const animateMarkFixSmooth = (timeNow) => {
            if (timeAnimStart === null) {
              timeAnimStart = timeNow;
            }

            if (!params.locsFix || params.locsFix.length === 0) {
              requestAnimationFrame(animateMarkFixSmooth);
              return; 
            }

            const timeElapsed = timeNow - timeAnimStart;
            const t = Math.min(timeElapsed / durTotal, 1);
            const idxFloat = t * (params.locsFix.length - 1);
            const idxA = Math.floor(idxFloat);
            if (Number.isNaN(idxA) || idxA < 0 || idxA >= params.locsFix.length) {
              return;
            }

            const idxB = Math.min(idxA + 1, params.locsFix.length - 1);
            const frac = idxFloat - idxA;

            const xLoc =
              params.locsFix[idxA].x +
              frac * (params.locsFix[idxB].x - params.locsFix[idxA].x);
            const yLoc =
              params.locsFix[idxA].y +
              frac * (params.locsFix[idxB].y - params.locsFix[idxA].y);

            runMarkFixCalibr(xLoc, yLoc);

            if (idxA !== iLocCur) {
              if (iLocCur >= 0) state.calFix.timesEndFix.push(Date.now());
              iLocCur = idxA;
              state.calFix.xxFix.push(params.locsFix[idxA].x);
              state.calFix.yyFix.push(params.locsFix[idxA].y);
              state.calFix.dursFix.push(params.durFix);
              state.calFix.dursGap.push(params.durGap);
              state.calFix.arrWindowInnerWidth.push(window.innerWidth);
              state.calFix.arrWindowOuterWidth.push(window.outerWidth);
              state.calFix.arrWindowInnerHeight.push(window.innerHeight);
              state.calFix.arrWindowOuterHeight.push(window.outerHeight);
              state.calFix.arrWindowScreenX.push(window.screenX);
              state.calFix.arrWindowScreenY.push(window.screenY);
              state.calFix.timesStartFix.push(Date.now());
            }

            if (timeElapsed < durTotal) {
              requestAnimationFrame(animateMarkFixSmooth);
            } else {
              state.calFix.timesEndFix.push(Date.now());
              jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
            }
          };
          requestAnimationFrame(animateMarkFixSmooth);
        } else {
        */

        const moveMarkFix = (iLoc) => {

          const timeElapsed = Date.now() - state.calFix.timeAnimStartFixFirst;
          if (params.durSection && timeElapsed >= params.durSection) {
            state.calFix.timesEndFix.push(Date.now());
            jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
            return;
          }

          const xLoc = params.locsFix[iLoc].x;
          const yLoc = params.locsFix[iLoc].y;
          runMarkFixCalibr(xLoc, yLoc);
          state.calFix.xxFix.push(xLoc);
          state.calFix.yyFix.push(yLoc);
          state.calFix.dursFix.push(params.durFix);
          state.calFix.dursGap.push(params.durGap);
          state.calFix.arrWindowInnerWidth.push(window.innerWidth);
          state.calFix.arrWindowOuterWidth.push(window.outerWidth);
          state.calFix.arrWindowInnerHeight.push(window.innerHeight);
          state.calFix.arrWindowOuterHeight.push(window.outerHeight);
          state.calFix.arrWindowScreenX.push(window.screenX);
          state.calFix.arrWindowScreenY.push(window.screenY);

          const timeAnimStartTarg = Date.now();
          state.calFix.timesStartFix.push(timeAnimStartTarg);
          const delay =
            (iLoc + 1) * (params.durFix + params.durGap) -
            (timeAnimStartTarg - state.calFix.timeAnimStartFixFirst);

          if (iLoc < params.locsFix.length - 1) {
            setTimeout(() => {
              state.calFix.timesEndFix.push(Date.now());
              moveMarkFix(iLoc + 1);
            }, delay);
          } else {
            setTimeout(() => {
              state.calFix.timesEndFix.push(Date.now());
              jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
            }, delay);
          }
        };
        // @THINK - end of ELSE should be here

        et_etSetupInitStartSimple(
          paramsEt,
          collectSnapshots ?? false,
          paramsConfig,
          et_calibr_onResultsModel,
        );
        moveMarkFix(0);

      },
      on_start: () => {},
      on_finish: () => {
        et_etStop();
        et_etRemoveLayout();
        if (!params.keepDecorOnFinish) {
          et_etRemoveDecor();
        }
        et_videoPause();

        if (params.applyCalibr) {
          const useForCalibr = et_calibrFilterSamples(
            arrTimeStartFm,
            params.durDiscardFixStart,
            params.durDiscardFixEnd,
          );
          const arrXyPredFmFiltered = arrXyPredFm.filter(
            (_, iSample) => useForCalibr[iSample],
          );
          const arrXyTargFmFiltered = arrXyTargFm.filter(
            (_, iSample) => useForCalibr[iSample],
          );
          et_applyCalibr(arrXyPredFmFiltered, arrXyTargFmFiltered);
        }

        const paramsSave = { ...params };
        // paramsSave._locsFix = null;
        jsPsych.data.addDataToLastTrial({
          save_trial: true,
          assessment_stage: AssessmentStage.DATA,
          correct: true,
          type_trial: tagTrialEtCalibr,
          id_trial: params.idCalibr,
          pid: sessionGet(SK.CONFIG).pid,
          params_calibr: paramsSave,
        });
      },
    };
  };

  const trialShowLog = () => ({
    type: jsPsychHtmlButtonResponse,
    stimulus: () => `<pre>${JSON.stringify(state.cal.et, null, 2)}</pre>`,
    choices: ["OK"],
  });

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          prepareParams();
          audioGapBuffer = null;
          try {
            prepareAudio();
          } catch (e) {
            /* empty */
          }
        },
      },
      {
        timeline: [trialInstrPre],
        conditional_function: () =>
          params.playAudio &&
          mediaAssets.audio[params.keyAudioInstrPre] !== null,
      },
      // resetting bitsPerSecond only if they are explicitly specified
      t_et_videoRecordStart(
        paramsIn.videoBitsPerSecond != null
          ? { videoBitsPerSecond: paramsIn.videoBitsPerSecond }
          : {},
      ),
      trialCalibrate(),
      t_et_videoRecordSave(() => `${tagTrialEtCalibr}-${params.idCalibr}`),
      t_et_stateSave({
        idTrialSaveOrFn: () => `${tagTrialEtCalibr}-${params.idCalibr}`,
        saveCal: true,
        saveCalFix: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.MIN,
        requestUpload: true,
      }),
      {
        timeline: [trialShowLog()],
        conditional_function: () => params.showLog,
      },
    ],
    conditional_function: () => {
      const enableCalibr = paramsIn.isCalibrCollect
        ? sessionGet(SK.ET_CALIBRATE_COLLECT)
        : sessionGet(SK.ET_CALIBRATE);
      return sessionGet(SK.VIDEO_ENABLED) && enableCalibr;
    },
  };
};

// ===========================================================
//  TEST
// ===========================================================

const tagTrialEtTest = "et-test";

export const et_paramsTestDef = (tagReq = TAG_REQ_DEF) => ({
  tagReq: tagReq,
  showLog: false,
  keyAudioTest: [tagTrialEtTest, tagReq, ""],
  srcMarkFix: null,
  sizeMarkFix: 25,
  classAnimFix: "et-calibr-animation-rotate",
  showBurstGap: true,
  classAnimGap: null,
  playAudioGap: true,
  keyAudioGap: "sharedAudioChimeAll",
  textBtnTest: "TEST",
  textBtnNext: "NEXT",
  locsFix: [
    { x: 25, y: 25 },
    { x: 50, y: 50 },
    { x: 75, y: 75 },
    { x: 75, y: 25 },
    { x: 50, y: 50 },
    { x: 25, y: 75 },
  ],
  durFix: 3000,
  durGap: 1000,

  showGaze: true,
  showEyes: true,
  paramsDecor: null,
});

export const t_et_etTest = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params = null;
  let audioGap = null;

  let elMarkFix = null;

  const prepareAudio = () => {
    audioGap =
      params.playAudioGap && mediaAssets.audio[params.keyAudioGap]
        ? new Audio(mediaAssets.audio[params.keyAudioGap])
        : null;
  };

  const prepareParams = () => {
    // eslint-disable-next-line no-param-reassign
    paramsIn.tagReq ??= tagReq;

    params = {
      ...fillTextKeyValuesDef(et_paramsTestDef(paramsIn.tagReq)),
      ...fillTextKeyValuesDef(paramsIn),
    };
  };

  const htmlLayout = () => {
    const strVisLog = `visibility: ${params.showLog ? "visible" : "hidden"}`;
    const htmlMarkFix = et_htmlMarkFix(params.srcMarkFix, params.sizeMarkFix);
    const html = `
      <div id="id-log" style="${strVisLog}" class="roav-card-log"></div>
      ${htmlMarkFix}
      <div class="shared-tech-button-wrap" style="position:fixed; bottom:10vh; left:0; width:100%;">
        <button id="id-button-test" class="shared-tech-button-small">
          ${params.textBtnTest}
        </button>
        <button id="id-button-next" class="shared-tech-button-small">
          ${params.textBtnNext}
        </button>
      </div>
    `;
    return html;
  };

  const runMarkFixTest = (xLoc, yLoc) => {
    elMarkFix.style.left = `${xLoc}%`;
    elMarkFix.style.top = `${yLoc}%`;
    elMarkFix.style.visibility = "visible";
    if (params.classAnimGap) {
      elMarkFix.classList.remove(params.classAnimGap);
    }
    elMarkFix.classList.add(params.classAnimFix);

    state.xyTarg = { x: xLoc, y: yLoc };

    if (params.durGap > 0) {
      if (audioGap) {
        setTimeout(() => {
          audioGap.currentTime = 0;
          audioGap.play().catch(() => {});
        }, params.durFix);
      }

      if (params.showBurstGap) {
        setTimeout(() => {
          elMarkFix.style.visibility = "hidden";
          const xPx = (xLoc / 100) * window.innerWidth;
          const yPx = (yLoc / 100) * window.innerHeight;
          et_createBurstEffect(
            xPx,
            yPx,
            params.sizeMarkFix,
            2 * params.sizeMarkFix,
            params.durGap,
          );
        }, params.durFix);
      } else if (params.classAnimGap) {
        setTimeout(() => {
          elMarkFix.classList.remove(params.classAnimFix);
          elMarkFix.classList.add(params.classAnimGap);
        }, params.durFix);
      }
    }
  };

  const trialTest = {
    type: jsPsychAudioMultiResponse,
    stimulus: () =>
      mediaAssets.audio[params.keyAudioTest] ??
      mediaAssets.audio.sharedNullAudioAll,
    prompt: () => htmlLayout(),
    keyboard_choices: () => [TypeKey.DUMMY],
    button_choices: () => [],
    button_html: () => "",
    trial_ends_after_audio: () => false,
    on_load: () => {
      et_stateResetSnapshots();
      state.collectSnapshots = true;
      state.paramsSnapshot = {
        saveLandmarks: false,
        saveCoordsHead: false,
        saveImgNativeEye: false,
        saveImgScaledEye: false,
      };

      et_etCreateLayout({
        showGaze: params.showGaze,
        showEyes: params.showEyes,
      });
      et_etCreateDecor(params.paramsDecor);
      et_etInit();
      et_videoInit();
      et_videoStart();

      const elLog = document.getElementById("id-log");
      elLog.innerHTML = `<pre>${JSON.stringify(state.cal.et, null, 2)}</pre>`;

      elMarkFix = document.getElementById("id-et-mark-fix");

      const callbackOnBtnTestPress = () => {
        const moveMarkFix = (iLoc) => {
          const xLoc = params.locsFix[iLoc].x;
          const yLoc = params.locsFix[iLoc].y;
          runMarkFixTest(xLoc, yLoc);
          if (iLoc < params.locsFix.length - 1) {
            setTimeout(
              () => moveMarkFix(iLoc + 1),
              params.durFix + params.durGap,
            );
          }
        };
        moveMarkFix(0);
      };

      const btnTest = document.getElementById("id-button-test");
      btnTest.addEventListener("click", callbackOnBtnTestPress);

      const btnNext = document.getElementById("id-button-next");
      btnNext.addEventListener("click", () =>
        jsPsych.pluginAPI.pressKey(TypeKey.DUMMY),
      );

      et_etStart();
      const videoRecord = sessionGet(SK.VIDEO_RECORD);
      if (videoRecord) {
        et_videoRecordStart();
      }
    },
    on_start: () => {},
    on_finish: () => {
      et_etStop();
      et_etRemoveLayout();
      et_etRemoveDecor();
      et_videoPause();
    },
  };

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          prepareParams();
          prepareAudio();
        },
      },
      trialTest,
      t_et_videoRecordSave(tagTrialEtTest),
      t_et_stateSave({
        idTrialSaveOrFn: tagTrialEtTest,
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.MIN,
        requestUpload: true,
      }),
    ],
    conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
  };
};
