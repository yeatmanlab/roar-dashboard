/* eslint-disable no-underscore-dangle */
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";
import { AssessmentStage } from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";
import { jsPsych } from "../shared/helpers/taskSetup";
import { CALIBR_ET_DEF, CALIBR_VD_DEF, ET } from "./et_constants";

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
  videoRecorderMimeType: null, // @VIDEO FILE TYPE
  videoChunks: [],
  videoRecordUrl: null,
  timeStartVideoRecord: null,
  timeStopVideoRecord: null,

  typeModel: ET.ET.TYPE_MODEL_DEF,
  timeoutFm: ET.FM.TIMEOUT_FM_DEF,
  timeoutModel: ET.ET.TIMEOUT_MODEL_DEF,

  elMarkGaze: null,
  canvasWork: null, // just a general drawing canvas to pass between function calls

  continueProcessing: false,

  // === ongoing
  landmarks: null,
  img: null,
  widthImg: null,
  heightImg: null,

  imgsNativeEyePending: null,
  canvasNativeEyeL: null,
  canvasNativeEyeR: null,
  canvasScaledEyeL: null,
  canvasScaledEyeR: null,

  metricsIris: null,
  metricsHead: null,
  coordsIrisL: null, // 471, 470, 469, 472
  coordsIrisR: null, // 476, 475, 474, 477
  coordsIrisCenterL: null, // 468
  coordsIrisCenterR: null, // 473
  coordsEyeL: null, // 130, 27, 243, 23
  coordsEyeR: null, // 463, 257, 359, 253
  coordsEyeInnerL: null, // 33, 159, 133, 145
  coordsEyeInnerR: null, // 362, 386, 263, 374
  coordsEyeFullL: null, // 33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
  coordsEyeFullR: null, // 362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398

  coordsHead: null, // 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  coordsHeadExtr: null, // 234, 10, 454, 152

  // added later, for calculation of the head pose
  coordsNose: null, // 102, 6, 331, 2
  coordsNoseTip: null, // 1
  coordsPnP: null, // 33, 263, 1, 61, 291, 199

  vdCur: null,
  timeCur: null,
  timeStartFm: null,
  timeResFm: null,

  xyTarg: null, // ongoing target - 0-100 of monitor width @@THINK - how can it work for different monitor width?
  xyTargFm: null, // target that is being processed by the model
  xyModel: null,
  xyPred: null,
  xyPredPx: null,

  // === calibration

  calFix: {
    xxFix: null,
    yyFix: null,
    timeStartFixFirst: null,
    timesStartFix: null,
    timesEndFix: null,
    dursFix: null,
    dursGap: null,
  },

  cal: {
    htCalibrated: false,
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
      sizeIris: null, // (1080 * 11.7) / (10 * 50 * 1920) = 0.01316...
      vd: null, // 50
      flNorm: null, // 1
      flMult: null, // 1080
    },

    screen: {
      widthCm: null,
      widthPx: null,
    },

    ht: {
      widthHead: null,
      heightHead: null,
      xCenterHead: null,
      yCenterHead: null,
      coordsHead: null,
    },
  },

  // saving & snapshots
  collectSnapshots: true,
  paramsSnapshot: et_paramsSnapsotDef,
  snapshots: [],
};

export const et_stateResetCalTarg = () => {
  state.calFix.xxFix = [];
  state.calFix.yyFix = [];
  state.calFix.timeStartFixFirst = null;
  state.calFix.timesStartFix = [];
  state.calFix.timesEndFix = [];
  state.calFix.dursFix = [];
  state.calFix.dursGap = [];
  state.calFix.arrWindowInnerWidth = [];
  state.calFix.arrWindowOuterWidth = [];
  state.calFix.arrWindowInnerHeight = [];
  state.calFix.arrWindowOuterHeight = [];
  state.calFix.arrWindowScreenX = [];
  state.calFix.arrWindowScreenY = [];
  state.calFix.params = null;
};

export const et_stateSetFirekit = (firekit) => {
  state.firekit = firekit;
};

export const et_stateResetSnapshots = () => {
  state.snapshots = [];
};

// @@TODO: if needed, we can just save landmarks to snapshot
// with landmarks numbers as their IDs to reduce indexing level in DB
export const et_stateResetOngoing = (resetTarg = false) => {
  state.landmarks = null;
  state.img = null;
  state.widthImg = null;
  state.heightImg = null;

  state.metricsIris = null;
  state.metricsHead = null;
  state.coordsIrisL = null;
  state.coordsIrisR = null;
  state.coordsIrisCenterL = null;
  state.coordsIrisCenterR = null;
  state.coordsEyeL = null;
  state.coordsEyeR = null;
  state.coordsHead = null;
  state.coordsHeadExtr = null;
  state.coordsPnP = null;

  state.imgsNativeEyePending = null;

  if (resetTarg) {
    state.xyTarg = null;
  }
  state.xyTargFm = null;

  state.vdCur = null;
  state.timeCur = null;
  state.timeResFm = null;
  state.timeStartFm = null;

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
    timeStartFm: state.timeStartFm,
    timeResFm: state.timeResFm,
    timeStartVideoRecord: state.timeStartVideoRecord,
    vdCur: state.vdCur,

    widthImg: state.widthImg,
    heightImg: state.heightImg,

    metricsIris: state.metricsIris,
    metricsHead: state.metricsHead,
    coordsIrisL: state.coordsIrisL,
    coordsIrisR: state.coordsIrisR,
    coordsIrisCenterL: state.coordsIrisCenterL,
    coordsIrisCenterR: state.coordsIrisCenterR,
    coordsEyeL: state.coordsEyeL,
    coordsEyeR: state.coordsEyeR,
    coordsHeadExtr: state.coordsHeadExtr,
    coordsPnP: state.coordsPnP,

    xyTarg: state.xyTarg,
    xyTargFm: state.xyTargFm,
    xyModel: state.xyModel,
    xyPred: state.xyPred,
    xyPredPx: state.xyPredPx,

    landmarks: params.saveLandmarks ? state.landmarks : null,
    coordsHead: params.saveCoordsHead ? state.coordsHead : null,

    imgsNativeEye: state.imgsNativeEyePending,
    
    // with compression, but takes very LONG time
    /*
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
    */
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
    xCoordsIrisCenterL: [],
    yCoordsIrisCenterL: [],
    xCoordsIrisCenterR: [],
    yCoordsIrisCenterR: [],
    xCoordsEyeL: [],
    yCoordsEyeL: [],
    xCoordsEyeR: [],
    yCoordsEyeR: [],
    xCoordsHeadExtr: [],
    yCoordsHeadExtr: [],
    xCoordsPnP: [],
    yCoordsPnP: [],
    imgsNativeEye: []
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
    result.xCoordsIrisCenterL.push(s.coordsIrisCenterL?.[0] ?? null);
    result.yCoordsIrisCenterL.push(s.coordsIrisCenterL?.[1] ?? null);
    result.xCoordsIrisCenterR.push(s.coordsIrisCenterR?.[0] ?? null);
    result.yCoordsIrisCenterR.push(s.coordsIrisCenterR?.[1] ?? null);
    s.coordsEyeL.forEach(([x, y]) => {
      result.xCoordsEyeL.push(x);
      result.yCoordsEyeL.push(y);
    });
    s.coordsEyeR.forEach(([x, y]) => {
      result.xCoordsEyeR.push(x);
      result.yCoordsEyeR.push(y);
    });

    s.coordsHeadExtr?.forEach(([x, y]) => {
      result.xCoordsHeadExtr.push(x);
      result.yCoordsHeadExtr.push(y);
    });
    s.coordsPnP?.forEach(([x, y]) => {
      result.xCoordsPnP.push(x);
      result.yCoordsPnP.push(y);
    });
    result.imgsNativeEye.push(s.imgsNativeEye ?? null);
  });
  

  return result;
};

export const et_TypeSaveSnapshots = {
  NONE: "none",
  MIN: "min",
  FULL: "full",
};

export const et_stateInfoSave = (saveCal, saveCalFix, typeSaveSnapshots) => {
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
    calFix: saveCalFix ? state.calFix : null,
    snapshots: snapshotsRes,
  };
  return info;
};

export const et_paramsStateSaveDef = {
  idTrialSaveOrFn: null,
  saveCal: true,
  saveCalFix: false,
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
      infoSave = et_stateInfoSave(
        params.saveCal,
        params.saveCalFix,
        params.typeSaveSnapshots,
      );

      if (params.requestUpload) {
        const blob = new Blob([JSON.stringify(infoSave)], {
          type: "application/json",
        });
        try {
          url = await state.firekit.uploadFileOrBlobToStorage({
            // filename: `state_${idTrialSave}_${Date.now()}.json`,
            filename: `state_${idTrialSave}_${Date.now()}.webm`, // @TODO: should be .json but .json files are currently not allowed to be downloaded
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

      const tagUpload = params.requestUpload ? "upload" : "";

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: tagTrial,
        id_trial: `${tagUpload}:${tagTrial}:${idTrialSave}`,
        id_trial_save: idTrialSave,
        pid: sessionGet(SK.CONFIG).pid,
        url: url,
        state: params.requestUpload ? null : JSON.stringify(infoSave),
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

export const t_et_stateFallbackDef = () => ({
  type: jsPsychCallFunction,
  func: () => {
    et_stateFallbackDef();
  },
});
