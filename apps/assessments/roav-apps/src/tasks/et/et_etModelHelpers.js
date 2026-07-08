import ndarray from "ndarray";
import ops from "ndarray-ops";
import {
  fm_xMinFromCoords,
  fm_xMaxFromCoords,
  fm_yMinFromCoords,
  fm_yMaxFromCoords,
} from "./et_fmHelpers";
import { ET } from "./et_constants";
import { state } from "./et_state";

// /**
//  * Collects specified coordinates from FaceMesh landmarks.
//  *
//  * @param {Array<Object>} landmarks - The FaceMesh landmarks.
//  * @param {Array<number>} indices - The indices of landmarks to extract.
//  * @param {Array<Array<number>>} coordinates - The array to store extracted coordinates.
//  */
// export function collectCoordinates(landmarks, indices, coordinates) {
//   indices.forEach((index) => {
//     const point = landmarks[index];
//     coordinates.push([point.x, point.y]);
//   });
// }

/**
 * Preprocesses image data for model input.
 *
 * @param {Uint8ClampedArray} data - The image data array.
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @returns {Float32Array} Processed image data.
 */
export function model_preprocessImageData(data, width, height) {
  const dataFromImage = ndarray(new Float32Array(data), [width, height, 4]);
  const dataProcessed = ndarray(new Float32Array(width * height * 3), [
    1,
    3,
    height,
    width,
  ]);

  // Normalize 0-255 to 0 - 1
  ops.divseq(dataFromImage, 255.0);
  // Realign imageData from [224*224*4] to the correct dimension [1*3*224*224].
  ops.assign(
    dataProcessed.pick(0, 0, null, null),
    dataFromImage.pick(null, null, 2),
  );
  ops.assign(
    dataProcessed.pick(0, 1, null, null),
    dataFromImage.pick(null, null, 1),
  );
  ops.assign(
    dataProcessed.pick(0, 2, null, null),
    dataFromImage.pick(null, null, 0),
  );
  return new Float32Array(dataProcessed.data);
}

/**
 * Preprocesses keypoint data by normalizing it into a structured format.
 *
 * @param {number[]} data - An array of keypoint data extracted from an image.
 * @param {number} width - The width of the image (unused in this function but can be used for scaling).
 * @param {number} height - The height of the image (unused in this function but can be used for scaling).
 * @returns {Float32Array} - A new Float32Array containing the processed keypoint data.
 */
export function model_preprocessKps(data) {
  const dataFromImage = ndarray(new Float32Array(data), [data.length]);
  const dataProcessed = ndarray(new Float32Array(data.length), [
    1,
    data.length,
  ]);
  ops.assign(dataProcessed.pick(0, null), dataFromImage);

  return new Float32Array(dataProcessed.data);
}

export function model_prepareInput() {
  const xMinL = fm_xMinFromCoords(state.coordsEyeL);
  const yMinL = fm_yMinFromCoords(state.coordsEyeL);
  const xMaxL = fm_xMaxFromCoords(state.coordsEyeL);
  const yMaxL = fm_yMaxFromCoords(state.coordsEyeL);
  const xMinR = fm_xMinFromCoords(state.coordsEyeR);
  const yMinR = fm_yMinFromCoords(state.coordsEyeR);
  const xMaxR = fm_xMaxFromCoords(state.coordsEyeR);
  const yMaxR = fm_yMaxFromCoords(state.coordsEyeR);

  const kps = [
    xMinL,
    yMinL,
    xMaxL - xMinL,
    yMaxL - yMinL,
    xMinR,
    yMinR,
    xMaxR - xMinR,
    yMaxR - yMinR,
  ];

  const sizeImg = ET.ET.SIZE_IMG_EYE_MODEL;
  const imageDataL = state.canvasScaledEyeL
    .getContext("2d")
    .getImageData(0, 0, sizeImg, sizeImg);
  const inputL = {
    data: model_preprocessImageData(imageDataL.data, sizeImg, sizeImg),
    dims: [1, 3, sizeImg, sizeImg],
  };

  const imageDataR = state.canvasScaledEyeR
    .getContext("2d")
    .getImageData(0, 0, sizeImg, sizeImg);
  const inputR = {
    data: model_preprocessImageData(imageDataR.data, sizeImg, sizeImg),
    dims: [1, 3, sizeImg, sizeImg],
  };

  const kpsTensor = { data: model_preprocessKps(kps), dims: [1, kps.length] };

  return { input1: inputL, input2: inputR, kpsTensor };
}

export const model_xyModel = (resModel) => {
  const xyModel = {
    x: resModel.output.cpuData[0],
    y: resModel.output.cpuData[1],
  };
  return xyModel;
};

export const model_xyModelToPred = (xyModel, cal = null) => {
  const xyPred = {
    x: xyModel.x * 100 - 50,
    y: xyModel.y * 100,
  };
  if (cal != null) {
    xyPred.x = xyPred.x * cal.xCoeff + cal.xIntercept;
    xyPred.y = xyPred.y * cal.yCoeff + cal.yIntercept;
  }

  return xyPred;
};

export const model_xyPred = (resModel, cal = null) => {
  const xyModel = model_xyModel(resModel);
  const xyPred = model_xyModelToPred(xyModel, cal);
  return xyPred;
};

// TODO: this is VERY important - do we scale by window or by screen???
export const model_xyPredToPredPx = (xyPred) => {
  const xyPredPx = {
    x: (xyPred.x * window.innerWidth) / 100.0,
    y: (xyPred.y * window.innerHeight) / 100.0,
  };
  return xyPredPx;
};
