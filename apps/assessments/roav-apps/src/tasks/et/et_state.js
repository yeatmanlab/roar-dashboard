/* eslint-disable no-underscore-dangle */
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";
import { AssessmentStage } from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";
import { jsPsych } from "../shared/helpers/taskSetup";
import { CALIBR_ET_DEF, CALIBR_VD_DEF } from "./et_constants";

// TODO:
// SUPER IMPORTANT: figure out when we are saving ---
// we might not be runnign ET at all, only FM to estimate distance

const KEYS_SNAPSHOT_MIN = [
  "vdCur",
  "timeStartFm",
  "xyTargFm",
  "xyModel",
  "xyPred",
  "xyPredPx",
];

export const et_paramsSnapsotDef = {
  saveLandmarks: false,
  saveCoordsHead: false,
  saveImgNativeEye: false,
  saveImgScaledEye: false,
};

export const state = {
  firekit: null,
  faceMesh: null,
  workerONNX: null,
  videoIn: null,
  cameraStream: null,
  videoRecorder: null,
  videoChunks: [],
  videoRecordUrl: null,
  timeStartVideoRecord: null,

  elMarkGaze: null,
  canvasWork: null, // just a general drawing canvas to pass between function calls

  continueProcessing: false,

  // === ongoing
  landmarks: null,
  img: null,
  widthImg: null,
  heightImg: null,

  canvasNativeEyeL: null,
  canvasNativeEyeR: null,
  canvasScaledEyeL: null,
  canvasScaledEyeR: null,

  metricsIris: null,
  metricsHead: null,
  coordsIrisL: null,
  coordsIrisR: null,
  coordsEyeL: null,
  coordsEyeR: null,
  coordsHead: null,

  vdCur: null,
  timeCur: null,
  timeStartFm: null,
  timeResFm: null,

  xyTarg: null, // ongoing target // 0-100 of monitor width - insane!!!!!!!!!!!
  xyTargFm: null, // target that is being processed by the model
  xyModel: null,
  xyPred: null,
  xyPredPx: null, // TODO: fill this in

  // === calibration

  cal: {
    htCalibrated: false, // not used currently
    vdCalibrated: false,
    etCalibrated: false,
    screenCalibrated: false,

    et: {
      xCoeff: null, // -3.49,
      xIntercept: null, // 45,
      yCoeff: null, // 0
      yIntercept: null, // 0
    },

    vd: {
      sizeIris: null, // (1080 * 11.7) / (10 * 50 * 1920)    // 0.01316
      vd: null, // 50
      flNorm: null, // 1
      flMult: null, // 1080
    },

    screen: {
      widthCm: null,
      widthPx: null,
    },

    ht: {
      // not used currently
      widthHead: null,
      heightHead: null,
      xCenterHead: null,
      yCenterHead: null,
      coordsHead: null,
    },
  },

  // saving & snapshots
  collectSnapshots: true,
  paramsSnapshot: et_paramsSnapsotDef, // will be defaulted to et_paramsSnapshotDef
  snapshots: [],
};

export const et_stateSetFirekit = (firekit) => {
  state.firekit = firekit;
};

export const et_stateResetSnapshots = () => {
  state.snapshots = [];
};

// TODO: update all of that
export const et_stateResetOngoing = () => {
  state.landmarks = null;
  state.img = null;
  state.widthImg = null;
  state.heightImg = null;

  // state.canvasNativeEyeL = null;
  // state.canvasNativeEyeR = null;
  // state.canvasScaledEyeL = null;
  // state.canvasScaledEyeR = null;

  state.metricsIris = null;
  state.metricsHead = null;
  state.coordsIrisL = null;
  state.coordsIrisR = null;
  state.coordsEyeL = null;
  state.coordsEyeR = null;
  state.coordsHead = null;

  state.vdCur = null;
  state.timeCur = null;
  state.timeResFm = null;
  state.timeStartFm = null;

  // state.xyTarg = null; - this is NOT set by iterations
  // state.xyTargFm = null;
  state.xyModel = null;
  state.xyPred = null;
  state.xyPredPx = null;
};

export const et_stateResetCal = () => {
  state.cal.htCalibrated = false;
  state.cal.vdCalibrated = false;
  state.cal.etCalibrated = false;
  state.cal.screenCalibrated = false;

  state.cal.et = {
    xCoeff: null,
    xIntercept: null,
    yCoeff: null,
    yIntercept: null,
  };

  state.cal.vd = {
    sizeIris: null,
    vd: null,
    flNorm: null,
    flMult: null,
  };

  state.cal.screen = {
    widthCm: null,
    widthPx: null,
  };

  state.cal.ht = {
    // not used currently
    widthHead: null,
    heightHead: null,
    xCenterHead: null,
    yCenterHead: null,
    coordsHead: null,
  };
};

export const et_stateSnapshot = (paramsIn = {}) => {
  const params = { ...state.paramsSnapshot, ...paramsIn };
  const snapshot = {
    // timeCur: state.timeCur,  // aux, not informative time - maybe remove it
    timeStartFm: state.timeStartFm,
    timeResFm: state.timeResFm,
    timeStartVideoRecord: state.timeStartVideoRecord,
    vdCur: state.vdCur,

    // img: null, // TODO: do not save, we have video
    widthImg: state.widthImg,
    heightImg: state.heightImg,

    metricsIris: state.metricsIris,
    metricsHead: state.metricsHead,
    coordsIrisL: state.coordsIrisL,
    coordsIrisR: state.coordsIrisR,
    coordsEyeL: state.coordsEyeL,
    coordsEyeR: state.coordsEyeR,

    xyTarg: state.xyTarg,
    xyTargFm: state.xyTargFm,
    xyModel: state.xyModel,
    xyPred: state.xyPred,
    xyPredPx: state.xyPredPx,

    // extras
    landmarks: params.saveLandmarks ? state.landmarks : null,
    coordsHead: params.saveCoordsHead ? state.coordsHead : null,

    // imgNativeEyeL: params.saveImgNativeEye ? state.canvasNativeEyeL?.getContext('2d').getImageData(0, 0, state.canvasNativeEyeL.width, state.canvasNativeEyeL.height) ?? null : null,
    // imgNativeEyeR: params.saveImgNativeEye ? state.canvasNativeEyeR?.getContext('2d').getImageData(0, 0, state.canvasNativeEyeR.width, state.canvasNativeEyeR.height) ?? null : null,
    // imgScaledEyeL: params.saveImgScaledEye ? state.canvasScaledEyeL?.getContext('2d').getImageData(0, 0, state.canvasScaledEyeL.width, state.canvasScaledEyeL.height) ?? null : null,
    // imgScaledEyeR: params.saveImgScaledEye ? state.canvasScaledEyeR?.getContext('2d').getImageData(0, 0, state.canvasScaledEyeR.width, state.canvasScaledEyeR.height) ?? null : null,

    // with compression, but takes very LONG time
    imgNativeEyeL: params.saveImgNativeEye
      ? state.canvasNativeEyeL?.toDataURL("image/png") ?? null
      : null,
    imgNativeEyeR: params.saveImgNativeEye
      ? state.canvasNativeEyeR?.toDataURL("image/png") ?? null
      : null,
    imgScaledEyeL: params.saveImgScaledEye
      ? state.canvasScaledEyeL?.toDataURL("image/png") ?? null
      : null,
    imgScaledEyeR: params.saveImgScaledEye
      ? state.canvasScaledEyeR?.toDataURL("image/png") ?? null
      : null,
  };
  return snapshot;
};

export const et_stateSnapshotsToMin = (snapshots) => {
  if (!snapshots) {
    return null;
  }
  const snapshotsMin = snapshots.map((s) =>
    Object.fromEntries(KEYS_SNAPSHOT_MIN.map((k) => [k, s[k]])),
  );
  return snapshotsMin;
};

export const et_stateSnapshotsToMinArrays = (snapshots) => {
  if (!snapshots) return null;

  const result = {
    vdCur: [],
    timeStartFm: [],
    timeResFm: [],
    widthIrisL: [],
    widthIrisR: [],
    widthHead: [],
    heightHead: [],
    xCenterHead: [],
    yCenterHead: [],
    xCentroidHead: [],
    yCentroidHead: [],
    xTarg: [],
    yTarg: [],
    xTargFm: [],
    yTargFm: [],
    xModel: [],
    yModel: [],
    xPred: [],
    yPred: [],
    xPredPx: [],
    yPredPx: [],
    xCoordsIrisL: [],
    yCoordsIrisL: [],
    xCoordsIrisR: [],
    yCoordsIrisR: [],
    xCoordsEyeL: [],
    yCoordsEyeL: [],
    xCoordsEyeR: [],
    yCoordsEyeR: [],
  };

  snapshots.forEach((s) => {
    result.vdCur.push(s.vdCur);
    result.timeStartFm.push(s.timeStartFm);
    result.timeResFm.push(s.timeResFm);

    result.widthIrisL.push(s.metricsIris?.widthIrisL ?? null);
    result.widthIrisR.push(s.metricsIris?.widthIrisR ?? null);

    result.widthHead.push(s.metricsHead?.widthHead ?? null);
    result.heightHead.push(s.metricsHead?.heightHead ?? null);
    result.xCenterHead.push(s.metricsHead?.xCenterHead ?? null);
    result.yCenterHead.push(s.metricsHead?.yCenterHead ?? null);
    result.xCentroidHead.push(s.metricsHead?.xCentroidHead ?? null);
    result.yCentroidHead.push(s.metricsHead?.yCentroidHead ?? null);

    result.xTarg.push(s.xyTarg?.x ?? null);
    result.yTarg.push(s.xyTarg?.y ?? null);
    result.xTargFm.push(s.xyTargFm?.x ?? null);
    result.yTargFm.push(s.xyTargFm?.y ?? null);
    result.xModel.push(s.xyModel?.x ?? null);
    result.yModel.push(s.xyModel?.y ?? null);
    result.xPred.push(s.xyPred?.x ?? null);
    result.yPred.push(s.xyPred?.y ?? null);
    result.xPredPx.push(s.xyPredPx?.x ?? null);
    result.yPredPx.push(s.xyPredPx?.y ?? null);

    s.coordsIrisL.forEach(([x, y]) => {
      result.xCoordsIrisL.push(x);
      result.yCoordsIrisL.push(y);
    });
    s.coordsIrisR.forEach(([x, y]) => {
      result.xCoordsIrisR.push(x);
      result.yCoordsIrisR.push(y);
    });
    s.coordsEyeL.forEach(([x, y]) => {
      result.xCoordsEyeL.push(x);
      result.yCoordsEyeL.push(y);
    });
    s.coordsEyeR.forEach(([x, y]) => {
      result.xCoordsEyeR.push(x);
      result.yCoordsEyeR.push(y);
    });
  });

  return result;
};

// TODO: update all of that

export const et_TypeSaveSnapshots = {
  NONE: "none",
  MIN: "min",
  FULL: "full",
};

export const et_stateInfoSave = (saveCal, typeSaveSnapshots) => {
  let snapshotsRes = null;
  if (typeSaveSnapshots === et_TypeSaveSnapshots.FULL) {
    snapshotsRes = state.snapshots;
  } else if (typeSaveSnapshots === et_TypeSaveSnapshots.MIN) {
    snapshotsRes = et_stateSnapshotsToMinArrays(state.snapshots);
  }

  const info = {
    timeStartVideoRecord: state.timeStartVideoRecord,
    widthImg: state.widthImg,
    heightImg: state.heightImg,
    cal: saveCal ? state.cal : null,
    snapshots: snapshotsRes,
  };
  return info;
};

export const et_paramsStateSaveDef = {
  idTrialSaveOrFn: null,
  saveCal: true,
  typeSaveSnapshots: et_TypeSaveSnapshots.MIN,
  requestUpload: false,
};

export const t_et_stateSave = (paramsIn) => {
  const params = { ...et_paramsStateSaveDef, ...paramsIn };
  params.idTrialSaveOrFn = paramsIn.idTrialSaveOrFn;

  let idTrialSave = null;
  let infoSave = null;
  let url = null;
  const tagTrial = "et-state-save";
  return {
    type: jsPsychCallFunction,
    async: true,
    func: async (done) => {
      idTrialSave =
        typeof params.idTrialSaveOrFn === "function"
          ? params.idTrialSaveOrFn()
          : params.idTrialSaveOrFn;
      infoSave = et_stateInfoSave(params.saveCal, params.typeSaveSnapshots);

      if (params.requestUpload) {
        const blob = new Blob([JSON.stringify(infoSave)], {
          type: "application/json",
        });
        try {
          url = await state.firekit.uploadFileOrBlobToStorage({
            // filename: `state_${idTrialSave}_${Date.now()}.json`,
            filename: `state_${idTrialSave}_${Date.now()}.webm`, // TODO: should be .json
            assessmentPid: sessionGet(SK.CONFIG).pid,
            fileOrBlob: blob,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("ET: error uploading state:", e);
        }
      }
      done();
    },
    on_finish: () => {
      // TODO: should be false
      const debugSave = false;
      if (debugSave) {
        const blob = new Blob([JSON.stringify(infoSave)], {
          type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${idTrialSave}.json`;
        a.click();
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: tagTrial,
        id_trial: `${tagTrial}:${idTrialSave}`,
        id_trial_save: idTrialSave,
        pid: sessionGet(SK.CONFIG).pid,
        url: url,
        state: params.requestUpload ? null : infoSave,
      });
    },
  };
};

export const et_stateFallbackDef = () => {
  state.cal.screenCalibrated = sessionGet(SK.SCREEN_CALIBRATED);
  state.cal.screen.widthCm = sessionGet(SK.WIDTH_SCREEN_CM);
  state.cal.screen.widthPx = sessionGet(SK.WIDTH_WINDOW_FS);

  if (!state.cal.etCalibrated) {
    state.cal.et = CALIBR_ET_DEF;
  }

  if (!state.cal.vdCalibrated) {
    state.cal.vd = CALIBR_VD_DEF;
  }
};

// TODO: super important --- record eye contours at each iteration (+ iris contours if possible) - to estimate head position
export const t_et_stateFallbackDef = () => ({
  type: jsPsychCallFunction,
  func: () => {
    et_stateFallbackDef();
  },
});

// async function et_etRunIteration() {
//   const {faceMesh, videoIn} = state;
//   if (!faceMesh || !et_videoValid(videoIn)) { ... }

//   if (state.timeCur !== null) {       // skip first iteration
//     et_snapshotState();               // capture completed previous iteration
//   }
//   et_stateResetOngoing();
//   ...
