import jsPsychAudioButtonResponse from "@jspsych/plugin-audio-button-response";
// import store from "store2";
import { mediaAssets } from "../shared/helpers/mediaAssets";

/*
import {
  // eslint-disable-next-line no-unused-vars
  FACEMESH_LEFT_EYE,
  FACEMESH_RIGHT_EYE
} from "@mediapipe/face_mesh";
*/
import { state } from "./et_state";
import {
  // FM_CONT_IRIS_L,
  // FM_CONT_IRIS_R,
  // FM_CONT_HEAD,
  FM_PNTS_EYE_L,
  // FM_PNTS_EYE_R,
  fm_fmRun,
  fm_xMinFromCoords,
  fm_xMaxFromCoords,
  fm_yMinFromCoords,
  fm_yMaxFromCoords,
  // fm_drawBB,
  // fm_drawContour,
  // fm_indsPairToCoords,
  fm_indsToCoords,
  // fm_calcCentroid,
  // fm_drawPoint,
} from "./et_fmHelpers";

import {
  et_videoInit,
  et_videoPause,
  et_videoStart,
  // et_videoStop,
} from "./et_videoHelpers";

// TODO: temporary for saving images
export const arrSrcEyeCrop = [];
const STEP_EYE_CROP_SAVE = 10;
let cntEyeCropSave = 0;
let recordEyeCrop = false;

const imgToSrcEyeCrop = (image, xMinCrop, yMinCrop, widthCrop, heightCrop) => {
  const eyeCropCanvas = document.createElement("canvas");
  const eyeCropCtx = eyeCropCanvas.getContext("2d");
  eyeCropCanvas.width = widthCrop;
  eyeCropCanvas.height = heightCrop;
  eyeCropCtx.drawImage(
    image,
    xMinCrop,
    yMinCrop,
    widthCrop,
    heightCrop,
    0,
    0,
    widthCrop,
    heightCrop,
  );
  const srcEyeCrop = eyeCropCanvas.toDataURL("image/png");
  return srcEyeCrop;
};

export async function saveArrSrcEyeCrop() {
  const handleDir = await window.showDirectoryPicker();
  await Promise.all(
    arrSrcEyeCrop.map(async (src, i) => {
      const handleFile = await handleDir.getFileHandle(`eye_crop_${i}.png`, {
        create: true,
      });
      const writable = await handleFile.createWritable();
      const base64 = src.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      await writable.write(bytes);
      await writable.close();
    }),
  );
}

export function im_eye_onResultsFaceMesh(results) {
  const canvasEyeL = document.getElementById("id-canvas-eye-left");
  const canvasEyeR = document.getElementById("id-canvas-eye-right");
  if (!canvasEyeL || !canvasEyeR) {
    return;
  }

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    return;
  }

  results.multiFaceLandmarks.forEach((landmarks) => {
    const coordsEyeL = fm_indsToCoords(landmarks, FM_PNTS_EYE_L);
    // const coordsEyeR = fm_indsToCoords(landmarks, FM_PNTS_EYE_R);

    const widthImg = results.image.width;
    const heightImg = results.image.height;

    const xMinEyeL = fm_xMinFromCoords(coordsEyeL);
    const xMaxEyeL = fm_xMaxFromCoords(coordsEyeL);
    const yMinEyeL = fm_yMinFromCoords(coordsEyeL);
    const yMaxEyeL = fm_yMaxFromCoords(coordsEyeL);

    const widthEyeL = xMaxEyeL - xMinEyeL;
    const heightEyeL = yMaxEyeL - yMinEyeL;

    const ctx = canvasEyeL.getContext("2d");
    ctx.clearRect(0, 0, canvasEyeL.width, canvasEyeL.height);
    ctx.drawImage(
      results.image,
      xMinEyeL * widthImg,
      yMinEyeL * heightImg,
      widthEyeL * widthImg,
      heightEyeL * heightImg,
      0,
      0,
      canvasEyeL.width,
      canvasEyeL.height,
    );

    if (recordEyeCrop && cntEyeCropSave % STEP_EYE_CROP_SAVE === 0) {
      const srcEyeCrop = imgToSrcEyeCrop(
        results.image,
        xMinEyeL * widthImg,
        yMinEyeL * heightImg,
        widthEyeL * widthImg,
        heightEyeL * heightImg,
      );
      arrSrcEyeCrop.push(srcEyeCrop);
    }
    cntEyeCropSave = (cntEyeCropSave + 1) % STEP_EYE_CROP_SAVE;
  });
}

const paramsImEyeDef = {
  // TODO:  should not be here -- those are (requested) sized of camera image -
  //        should be saved to config when camera starts
  heightCanvas: 50, // %vh  // TODO: should be in styles, not here
  leftright: "right",
};

export const t_et_imEye = (paramsIn = {} /* viewingDistance */) => {
  let params = null;

  const trialEye = {
    type: jsPsychAudioButtonResponse,
    trial_ends_after_audio: false,
    response_allowed_while_playing: false,

    stimulus: () => mediaAssets.audio.roavMpNullAudioAll,
    // eslint-disable-next-line arrow-body-style
    prompt: () => {
      // const configDevice = store.session.get("configDevice") ?? defaultDeviceConfig;
      return `
        <style>
          #jspsych-audio-button-response-btngroup { position: absolute; bottom: 5vh; left: 50%; transform: translateX(-50%); z-index: 1 }
          .jspsych-display-element .jspsych-btn { font-size: 3vh; }
          #id-stripe-left  { position: fixed; top: 0px; left: 0vw; width: 10vw; height: 100vh; background: #0000ff; z-index: 0 }
          #id-stripe-right { position: fixed; top: px; right: 0vw; width: 10vw; height: 100vh; background: #0000ff; z-index: 0}
          #id-stripe-center { position: fixed; top: 0px; right: 40vw; width: 20vw; height: 100vh; background: #0000ff; z-index: 0}
        </style>
        <div id="id-stripe-left"></div>
        <div id="id-stripe-right"></div>
        <div style="text-align: center; margin-top: -15vh; z-index: 10">
          <div style="width: ${params.widthImdEye}; height:auto; margin:0 auto;">
            <canvas id="id-canvas-eye-left" style="width:100%; height:100%"></canvas>
            <canvas id="id-canvas-eye-right" style="width:100%; height:100%"></canvas>
          </div>
        </div>
        <div style="position: fixed; bottom: 15vh; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; gap: 1rem;">
          <button id="id-btn-stripes">TOGGLE STRIPES</button>
          <button id="id-btn-record-start">START RECORDING</button>
          <button id="id-btn-save">SAVE</button>
        </div>
        `;
    },
    choices: ["NEXT"],
    on_load: () => {
      // state.canvasWork = document.getElementById("id-cr-head-canvas");
      const toggleStripes = () => {
        const elStripeL = document.getElementById("id-stripe-left");
        const elSrtipeR = document.getElementById("id-stripe-right");
        const elStripeC = document.getElementById("id-stripe-center");
        const vis =
          elStripeL?.style.visibility === "hidden" ? "visible" : "hidden";
        if (elStripeL) elStripeL.style.visibility = vis;
        if (elSrtipeR) elSrtipeR.style.visibility = vis;
        if (elStripeC) elStripeC.style.visibility = vis;
      };

      document
        .getElementById("id-btn-stripes")
        .addEventListener("click", () => {
          toggleStripes();
        });

      document
        .getElementById("id-btn-save")
        .addEventListener("click", async () => {
          recordEyeCrop = false;
          await saveArrSrcEyeCrop();
          cntEyeCropSave = 0;
          arrSrcEyeCrop.length = 0;
        });

      document
        .getElementById("id-btn-record-start")
        .addEventListener("click", () => {
          cntEyeCropSave = 0;
          arrSrcEyeCrop.length = 0;
          recordEyeCrop = true;
        });

      et_videoInit();
      et_videoStart();
      state.faceMesh.onResults(im_eye_onResultsFaceMesh);
      // TODO: does not work without this timeout!!! processing some old messages?
      state.continueProcessing = true;
      setTimeout(() => fm_fmRun(), 1000);
    },
    on_start: () => {},
    on_finish: () => {
      state.continueProcessing = false;
      et_videoPause();
    },
  };

  return {
    timeline: [trialEye],
    on_timeline_start: () => {
      params = { ...paramsImEyeDef, ...paramsIn };
    },
  };
};
