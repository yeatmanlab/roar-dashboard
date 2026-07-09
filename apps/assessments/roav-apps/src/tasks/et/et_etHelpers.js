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
  // collectCoordinates,
} from "./et_etModelHelpers";
import { jsPsych } from "../shared/helpers/taskSetup";
// The eyetracking_google.onnx model is emitted by the build's copy step and fetched at
// runtime by et_worker.js — not imported here (rollup can't parse a raw .onnx module).
import {
  fm_def_beforeSendToFm,
  fm_def_fillStateOnResultsFm,
} from "./et_fmHelpers";
import {
  et_paramsSnapsotDef,
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
  // et_videoStop,
} from "./et_videoHelpers";
import { ht_def_fillStateOnResultsFm } from "./et_htHelpers";
import {
  fillTextKeyValuesDef,
  TAG_REQ_DEF,
  TypeKey,
} from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";

// WARNINGS:
// - ET calibration - should calibrate from resFm.image (FM) not from video that might have advanced (crops according to face mesh but image from video)
// - uses screen.height instead of window.innerWidth to calculate transform between model & prediction
// - (race condition) in calibration reads coords of xyTarg (blue disk) - can move by the time it is processed
// - gap (burst) is recorded in inference?

export const et_TypeDecor = {
  NONE: "none",
  STRIPES_LR: "stripes-lr",
};

export const et_TypeModel = {
  NONE: "none",
  AT_CROPS_BBS: "at-crops-bbs",
};

export const et_paramsDecorDef = {
  typeDecor: et_TypeDecor.STRIPES_LR,
  widthStripe: 5, // % of window width // TODO: maybe should be on % of screen width?
  clrStripe: "#0000ff",
};

export const et_paramsLayoutDef = {
  showEyes: true,
  showGaze: true,
};

export function et_etCreateDecor(paramsDecorIn) {
  const configEt = sessionGet(SK.CONFIG_ET);
  const paramsDecorConfig = configEt?.paramsDecor;
  const paramsDecor = {
    ...et_paramsDecorDef,
    ...paramsDecorConfig,
    ...paramsDecorIn,
  };
  if (paramsDecor.typeDecor === et_TypeDecor.STRIPES_LR) {
    const elStripeL = document.createElement("div");
    elStripeL.id = "id-et-stripe-l";
    elStripeL.className = "et-stripe-l";
    elStripeL.style.width = `${paramsDecor.widthStripe}vw`;
    elStripeL.style.background = paramsDecor.clrStripe;
    document.body.appendChild(elStripeL);

    const elStripeR = document.createElement("div");
    elStripeR.id = "id-et-stripe-r";
    elStripeR.className = "et-stripe-r";
    elStripeR.style.width = `${paramsDecor.widthStripe}vw`;
    elStripeR.style.background = paramsDecor.clrStripe;
    document.body.appendChild(elStripeR);
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

  if (!state.canvasNativeEyeL) {
    state.canvasNativeEyeL = document.createElement("canvas");
    state.canvasNativeEyeL.id = "id-et-canvas-native-eye-l";
    state.canvasNativeEyeL.className = "et-canvas-eye";
  }

  if (!state.canvasScaledEyeL) {
    state.canvasScaledEyeL = document.createElement("canvas");
    state.canvasScaledEyeL.id = "id-et-canvas-scaled-eye-l";
    state.canvasScaledEyeL.className = "et-canvas-eye";
  }

  if (!state.canvasNativeEyeR) {
    state.canvasNativeEyeR = document.createElement("canvas");
    state.canvasNativeEyeR.id = "id-et-canvas-native-eye-r";
    state.canvasNativeEyeR.className = "et-canvas-eye";
  }

  if (!state.canvasScaledEyeR) {
    state.canvasScaledEyeR = document.createElement("canvas");
    state.canvasScaledEyeR.id = "id-et-canvas-scaled-eye-r";
    state.canvasScaledEyeR.className = "et-canvas-eye";
  }
  // TODO: check 100000000 times about mirroring
  // TODO: temporary, it should not be here --- canvases have IDS can be positioned wheever by a caller
  if (params.showEyes) {
    document.body.appendChild(state.canvasScaledEyeL);
    document.body.appendChild(state.canvasScaledEyeR);
    document.body.appendChild(state.canvasNativeEyeL);
    document.body.appendChild(state.canvasNativeEyeR);

    const sizeCanvas = ET.ET.SIZE_IMG_EYE_MODEL;
    state.canvasScaledEyeL.style.top = 0;
    state.canvasScaledEyeL.style.left = 0;
    state.canvasScaledEyeL.style.transform = "scaleX(-1)";

    state.canvasScaledEyeR.style.top = 0;
    state.canvasScaledEyeR.style.left = `${sizeCanvas}px`;
    state.canvasScaledEyeR.style.transform = "scaleX(-1)";

    state.canvasNativeEyeL.style.top = `${sizeCanvas}px`;
    state.canvasNativeEyeL.style.left = 0;
    state.canvasNativeEyeL.style.transform = "scaleX(-1)";

    state.canvasNativeEyeR.style.top = `${sizeCanvas}px`;
    state.canvasNativeEyeR.style.left = `${sizeCanvas}px`;
    state.canvasNativeEyeR.style.transform = "scaleX(-1)";
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

// TODO: VERY important --- make sure that images of left and right eyes
//  and (-1) transform are correct input to the model

// TODO: this is complete insanity -- rewrite when not for calibration
// eslint-disable-next-line no-unused-vars
const et_def_onResultsModel = (resModel, params = {}) => {
  // TODO: super importnt --- save the state here!!! (add to an array of snapshots)
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

// TODO: IMPORTANT check what happens if window (camera) is closed
async function et_etRunIteration() {
  const { faceMesh, videoIn } = state;

  if (!faceMesh || !et_videoValid(videoIn)) {
    if (state.continueProcessing) {
      setTimeout(et_etRunIteration, ET.ET.TIMEOUT_RETRY_ITERATION);
    }
    return;
  }

  fm_def_beforeSendToFm();
  await faceMesh.send({ image: videoIn });

  if (!state.workerONNX) {
    // ET not requested, only FM + vd estimates
    if (state.continueProcessing) {
      setTimeout(et_etRunIteration, 0);
    }
  } else {
    try {
      if (!state.coordsEyeL || !state.coordsEyeR) {
        throw new Error("ET: no face detected");
      }
      const inputModel = model_prepareInput();
      state.workerONNX.postMessage(inputModel);
    } catch (error) {
      if (state.continueProcessing) {
        setTimeout(et_etRunIteration, ET.ET.TIMEOUT_RETRY_ITERATION);
      }
    }
  }
}

// TODO: assumes that state.faceMesh is already initialized
export const et_etInit = (
  onResultsFaceMesh = et_def_onResultsFaceMesh,
  onResultsModel = et_def_onResultsModel, // = null if want FM only
) => {
  et_stateResetOngoing();

  state.continueProcessing = true;

  state.faceMesh.onResults(onResultsFaceMesh);

  if (!onResultsModel) {
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
    // state.workerONNX.onmessage = async (e) => {
    state.workerONNX.onmessage = (e) => {
      // @@NEW - removed async
      if (e.data.error) {
        // eslint-disable-next-line no-console
        console.error("ET: error from worker:", e.data.error);
      } else {
        onResultsModel(e.data);
      }
      if (state.continueProcessing) {
        et_etRunIteration();
      }
    };
  }
};

export function et_etStop() {
  state.continueProcessing = false;

  if (state.faceMesh.onResults) {
    state.faceMesh.onResults(() => {});
  }

  // @@new - begin
  /*
  if (state.workerONNX) {
    state.workerONNX.terminate();
    state.workerONNX = null;
  }
  */
  // @@new - end
}

export const et_etStart = () => {
  et_etRunIteration();
};

// @new - begin
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
// @new - end

// Define the locsFix with repetition to cover 3 seconds at 10ms intervals

// export const et_paramsTestDef = {
//   xxFixRandom: [0.5, 0.5, 0.5, 0.5, 0.2, 0.4, 0.6, 0.8],
//   yyFixRandom: [0.5, 0.5, 0.5, 0.5, 0.2, 0.4, 0.6, 0.8],
//   durationFixRandom: 3000,
//   locsFixCenterCorner: [
//     { x: 0.2, y: 0.2 },
//     { x: 0.2, y: 0.8 },
//     { x: 0.8, y: 0.2 },
//     { x: 0.8, y: 0.8 },
//     { x: 0.5, y: 0.5 },
//     { x: 0.5, y: 0.5 },
//   ],
//   durationFixCenterCorner: 5000,
// };

// export const t_et_etTest = (paramsIn = {}) => {
//   const trialEtTest = {
//     type: jsPsychAudioButtonResponse,
//     trial_ends_after_audio: false,
//     response_allowed_while_playing: false,

//     stimulus: () => mediaAssets.audio.roavMpNullAudioAll,
//     // eslint-disable-next-line arrow-body-style
//     prompt: () => {
//       // const widthCanvas = (params.heightCanvas * 1920) / 1080;
//       // const configDevice = store.session.get("configDevice") ?? defaultDeviceConfig;
//       return `
//       <style>
//         .elBurst {
//           width: 10px; height: 10px;
//           background-color: inherit;
//           border-radius: 50%;
//           position: absolute;
//           transform: translate(-50%, -50%);
//           opacity: 0;
//         }
//         @keyframes spin {
//           0%   { transform: rotate(0deg); }
//           100% { transform: rotate(360deg); }
//         }
//         .spin { animation: spin 2s linear infinite; }
//         #id-mark-fix {
//           position: fixed;
//           width: 25px;
//           height: 50px;
//           background-color: #ff0000;
//           border-radius: 50%;
//           display: block;
//           transform: translate(-50%, -50%);
//           visibility: hidden;
//         }
//         @keyframes burst {
//           0%   { transform: scale(1); opacity: 1; }
//           100% { transform: translate(var(--dx), var(--dy)) scale(0.5); opacity: 0; }
//         }
//         #jspsych-audio-button-response-btngroup { position: absolute; bottom: 5vh; left: 50%; transform: translateX(-50%); }
//         .jspsych-display-element .jspsych-btn { font-size: 3vh; }
//         #id-aux-wrap { position: fixed; top: 10px; right: 10px; width: 15vw; height: 15vh; border: 1px solid black; text-align: left; font-size: 1.5vh; padding: 10px; }
//       </style>
//       <div id="id-aux-wrap" style="font-size: 2vh">
//           <div id='id-msg-calibr'>
//           </div>
//       </div>
//       <div id="id-mark-fix" class="spin"></div>
//     `;
//     },
//     choices: ["CENTER & CORNERS", "NEXT"],
//     on_load: () => {
//       const elMsgCalibr = document.getElementById("id-msg-calibr");
//       elMsgCalibr.innerHTML = `<p>Tuning Coefficients</p>
//         <p>x coefficient: ${state.cal.et.xCoeff.toFixed(3)}</p>
//         <p>x intercept: ${state.cal.et.xIntercept.toFixed(3)}</p>
//         <p>y coefficient: ${state.cal.et.yCoeff.toFixed(3)}</p>
//         <p>y intercept: ${state.cal.et.yIntercept.toFixed(3)}</p>`;

//       et_etCreateLayout({ showGaze: true, showEyes: true });
//       et_etInit();
//       et_videoInit();
//       et_videoStart();
//       et_etRunIteration();

//       // TODO: make function et_createMarkFix()
//       elMarkFix = document.getElementById("id-mark-fix");
//       elMarkFix.style.display = "block";

//       let intervalFix = null;

//       // CENTER CORNER
//       document
//         .getElementById("jspsych-audio-button-response-button-0")
//         .addEventListener(
//           "click",
//           (e) => {
//             e.stopPropagation();
//             if (intervalFix) {
//               clearInterval(intervalFix);
//             }
//             elMarkFix.style.visibility = "visible";
//             intervalFix = setInterval(() => {
//               const indLoc = Math.floor(
//                 Math.random() * params.locsFixCenterCorner.length,
//               );
//               elMarkFix.style.left = `${
//                 params.locsFixCenterCorner[indLoc].x * 100
//               }%`;
//               elMarkFix.style.top = `${
//                 params.locsFixCenterCorner[indLoc].y * 100
//               }%`;
//             }, params.durationFixCenterCorner);
//           },
//           true,
//         );
//     },
//     on_start: () => {},
//     on_finish: () => {
//       et_etStop();
//       et_videoPause();
//       et_etRemoveLayout();
//       state.faceMesh.onResults(() => {});
//     },
//   };

//   return {
//     timeline: [trialEtTest],
//     on_timeline_start: () => {
//       params = { ...et_paramsTestDef, ...paramsIn };
//     },
//   };
// };

// TODO: instructions
// <ul>
//     <li>Center your head</li>
//     <li>Keep still</li>
//     <li>Press START CALIBRATION</li>
//     <li>Follow blue dot with your gaze</li>
//   </ul>
//
// AAAAAAAAAAAAA

const tagTrialEtCalibr = "et-calibr";

// TODO: why is it 65????????? (and not 75)? why is (50, 50) commented out
export const et_paramsCalibrDef = (tagReq = TAG_REQ_DEF) => ({
  tagReq: tagReq,
  showLog: true, // TODO: should be false
  playAudio: false,
  keyAudioInstrPre: [tagTrialEtCalibr, tagReq, "instr-pre"],
  keyAudioCalibr: [tagTrialEtCalibr, tagReq, "calibr"],
  srcMarkFix: null,
  sizeMarkFix: 25, // this is in pixels - sub-optimal, but OK at least for now
  classAnimFix: "et-calibr-animation-rotate",
  showBurstGap: true,
  classAnimGap: "", // placeholder - should take precedence over burst
  playAudioGap: true,
  keyAudioGap: "sharedAudioChimeAll", // TODO: play audio at the end
  // TODO: why on earth is it 65 in Y and not 75
  locsFix: [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 25, y: 65 },
    { x: 75, y: 65 },
  ],
  durFix: 3000,
  durDiscardFixStart: 1000,
  durDiscardFixEnd: 100,
  durGap: 800,

  showGaze: false,
  showEyes: false,
  paramsDecor: null,
  paramsSnapshot: null,
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

function et_createBurstEffect(x, y, sizeMarkFix, sizeBurst, durBurst) {
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
}

const et_applyCalibr = (arrPred, arrTarg) => {
  state.cal.etCalibrated = false;
  // alert(arrPred.length);
  if (arrPred.length < 2) {
    // eslint-disable-next-line no-console
    console.warn("ET: not enough calibration samples:", arrPred.length);
    return;
  }
  const xxPred = arrPred.map((val) => val.x);
  const yyPred = arrPred.map((val) => val.y);
  const xxTarg = arrTarg.map((val) => val.x);
  const yyTarg = arrTarg.map((val) => val.y);

  const xRegr = new PolynomialRegression(xxPred, xxTarg, 1);
  const yRegr = new PolynomialRegression(yyPred, yyTarg, 1);

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

  // TODO: maybe arrays should be inside trialCalibrate -
  // TODO: we might not need trialCalibrate at all - just put it directly into main trial
  const arrTarg = [];
  const arrPred = [];
  let elMarkFix = null;
  let useForCalibr = false;

  const prepareParams = () => {
    // eslint-disable-next-line no-param-reassign
    paramsIn.tagReq ??= tagReq;

    params = {
      ...fillTextKeyValuesDef(et_paramsCalibrDef(paramsIn.tagReq)),
      ...fillTextKeyValuesDef(paramsIn),
    };
  };

  // TODO: why are x and y scaled differently???
  const et_calibr_onResultsModel = (resModel) => {
    if (useForCalibr) {
      arrTarg.push(state.xyTargFm);
      state.xyModel = model_xyModel(resModel);
      state.xyPred = model_xyModelToPred(state.xyModel);
      // TODO: this is where we SAVE state!!!!!!!!!!!!!!!!!! into an array
      arrPred.push(state.xyPred);
      // TODO: whatever this is... what is useForCalibr...
    }
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
    useForCalibr = false;

    setTimeout(() => {
      useForCalibr = true;
    }, params.durDiscardFixStart);
    setTimeout(() => {
      useForCalibr = false;
    }, params.durFix - params.durDiscardFixEnd);

    if (params.durGap > 0) {
      if (params.playAudioGap && mediaAssets.audio[params.keyAudioGap]) {
        setTimeout(() => {
          new Audio(mediaAssets.audio[params.keyAudioGap]).play();
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

  const htmlLayout = () => {
    // const strVisLog = `visibility: ${params.showLog ? 'visible' : 'hidden'}`;
    const htmlMarkFix = et_htmlMarkFix(params.srcMarkFix, params.sizeMarkFix);
    //   <div id="id-log" style="${strVisLog}" class="roav-card-log"></div>
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

  const trialCalibrate = {
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
      state.collectSnapshots = configEt?.collectSnapshotsCalibr ?? true;
      state.paramsSnapshot = {
        ...et_paramsSnapsotDef,
        ...configEt?.paramsSnapshotCalibr,
        ...params.paramsSnapshot,
      };

      // TODO: very important --- should be TRUE with correct settings depending on config
      et_etCreateLayout({
        showGaze: params.showGaze,
        showEyes: params.showEyes,
      });
      et_etCreateDecor(params.paramsDecor);

      et_etInit(et_def_onResultsFaceMesh, et_calibr_onResultsModel);
      et_videoInit();
      et_videoStart();

      elMarkFix = document.getElementById("id-et-mark-fix");

      const moveMarkFix = (iLoc) => {
        const xLoc = params.locsFix[iLoc].x;
        const yLoc = params.locsFix[iLoc].y;
        runMarkFixCalibr(xLoc, yLoc);
        if (iLoc < params.locsFix.length - 1) {
          setTimeout(
            () => moveMarkFix(iLoc + 1),
            params.durFix + params.durGap,
          );
        } else {
          setTimeout(
            () => jsPsych.pluginAPI.pressKey(TypeKey.DUMMY),
            params.durFix + params.durGap,
          );
        }
      };
      moveMarkFix(0);

      et_etStart();
    },
    on_start: () => {},
    on_finish: () => {
      et_etStop();
      et_etRemoveLayout();
      et_etRemoveDecor();
      et_videoPause();
      et_applyCalibr(arrPred, arrTarg);

      // TODO: save!!!!!!!!!!!!!!!!!!! to FIRESTORE as recodrd
      // TODO: ON EACH ITERATION - save snapshot - record eyes if possible!!! [if allowed]
      // TODO: when attached to CR - do not save images of eyes, probably? or can save them for recalculation in the future
      // TODO: have a setting for blue lines during crowding experiments!!!
    },
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
        func: () => prepareParams(),
      },
      {
        timeline: [trialInstrPre],
        conditional_function: () =>
          mediaAssets.audio[params.keyAudioInstrPre] !== null,
      },
      t_et_videoRecordStart(),
      trialCalibrate,
      t_et_stateSave({
        idTrialSaveOrFn: tagTrialEtCalibr,
        saveCal: true,
        typeSaveSnapshots: et_TypeSaveSnapshots.MIN,
        requestUpload: true,
      }),
      {
        timeline: [trialShowLog()],
        conditional_function: () => params.showLog,
      },
      t_et_videoRecordSave(tagTrialEtCalibr),
    ],
    conditional_function: () =>
      sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_CALIBRATE),
  };
};

// TODO: very important - make sure that left and right are not inverted
//  with regards to what the model is trained on

// TODO: very important - make sure that left and right are not inverted
//  with regards to what the model is trained on

// ===========================================================
//  TEST
// ===========================================================

const tagTrialEtTest = "et-test";

// TODO: why is it 65????????? (and not 75)? why is (50, 50) commented out
export const et_paramsTestDef = (tagReq = TAG_REQ_DEF) => ({
  tagReq: tagReq,
  showLog: true, // TODO: should be false
  keyAudioTest: [tagTrialEtTest, tagReq, ""],
  srcMarkFix: null,
  sizeMarkFix: 25, // this is in pixels - sub-optimal, but OK at least for now
  classAnimFix: "et-calibr-animation-rotate",
  showBurstGap: true,
  classAnimGap: "", // placeholder - should take precedence over burst
  playAudioGap: true,
  keyAudioGap: "sharedAudioChimeAll",
  // textBtnTest: [tagTrialEtTest, tagReq, "text-button-test"],
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
  paramsSnapshots: null,
});

export const t_et_etTest = (paramsIn = {}, tagReq = TAG_REQ_DEF) => {
  let params = null;

  let elMarkFix = null;

  // TODO: probably do not need it, but let it stay for the future
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
      if (params.playAudioGap && mediaAssets.audio[params.keyAudioGap]) {
        setTimeout(() => {
          new Audio(mediaAssets.audio[params.keyAudioGap]).play();
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
      // TODO: do I need et_videoInit every time?
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
      // TODO: make sure that I can coordinate between timestamps
      // TODO: RECORDING IS CONDITIONED ON config settings
      const videoRecord = false;
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

      // TODO: save!!!!!!!!!!!!!!!!!!! to FIRESTORE as recodrd
      // TODO: ON EACH ITERATION - save snapshot - record eyes if possible!!! [if allowed]
      // TODO: when attached to CR - do not save images of eyes, probably? or can save them for recalculation in the future
      // TODO: have a setting for blue lines during crowding experiments!!!
    },
  };

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => prepareParams(),
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
