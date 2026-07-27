import jsPsychCallFunction from '@jspsych/plugin-call-function';

// import ndarray from "ndarray";
// import ops from "ndarray-ops";
import { et_stateResetOngoing, et_stateSnapshot, state } from './et_state';
import { ET } from './et_constants';

export const FM_CONT_IRIS_L = [
  [474, 475],
  [475, 476],
  [476, 477],
  [477, 474],
];

export const FM_CONT_IRIS_R = [
  [469, 470],
  [470, 471],
  [471, 472],
  [472, 469],
];

export const FM_CONT_HEAD = [
  [10, 338],
  [338, 297],
  [297, 332],
  [332, 284],
  [284, 251],
  [251, 389],
  [389, 356],
  [356, 454],
  [454, 323],
  [323, 361],
  [361, 288],
  [288, 397],
  [397, 365],
  [365, 379],
  [379, 378],
  [378, 400],
  [400, 377],
  [377, 152],
  [152, 148],
  [148, 176],
  [176, 149],
  [149, 150],
  [150, 136],
  [136, 172],
  [172, 58],
  [58, 132],
  [132, 93],
  [93, 234],
  [234, 127],
  [127, 162],
  [162, 21],
  [21, 54],
  [54, 103],
  [103, 67],
  [67, 109],
  [109, 10],
];

export const FM_PNTS_EYE_L = [130, 27, 243, 23];
export const FM_PNTS_EYE_R = [463, 257, 359, 253];

// export const calibrHtDef = {
//   xCenterHead: 0.4383369982242584,
//   yCenterHead: 0.6562557443976402,
//   heightHead: 0.3467509150505066,
//   widthHead: 0.17240141332149506,
//   widthIrisL: 29.442644119262695,
//   widthIrisR: 29.782133102416992,
//   contourHead: [
//     [0.4412970542907715, 0.4813721179962158],
//     [0.4646510183811188, 0.4823227524757385],
//     [0.48430705070495605, 0.48748111724853516],
//     [0.5025681853294373, 0.4987863302230835],
//     [0.5136374235153198, 0.5169670581817627],
//     [0.5202310681343079, 0.5401103496551514],
//     [0.5239146947860718, 0.5652479529380798],
//     [0.5248485207557678, 0.5970170497894287],
//     [0.5236638784408569, 0.6280523538589478],
//     [0.5220870971679688, 0.6599369645118713],
//     [0.519332766532898, 0.6945410370826721],
//     [0.5138625502586365, 0.7309722304344177],
//     [0.5065117478370667, 0.7603253722190857],
//     [0.4982540011405945, 0.7814207673072815],
//     [0.48702606558799744, 0.7993608713150024],
//     [0.4769010543823242, 0.8114907741546631],
//     [0.46630799770355225, 0.8215509057044983],
//     [0.4544796049594879, 0.8288376331329346],
//     [0.4395001232624054, 0.8312488794326782],
//     [0.42436403036117554, 0.8285082578659058],
//     [0.41225385665893555, 0.8210300207138062],
//     [0.40132373571395874, 0.8104891777038574],
//     [0.3908883333206177, 0.7982432246208191],
//     [0.3792901039123535, 0.7797933220863342],
//     [0.3707539737224579, 0.7583227753639221],
//     [0.36319053173065186, 0.728979766368866],
//     [0.35756009817123413, 0.6924722790718079],
//     [0.35495781898498535, 0.6577485203742981],
//     [0.35378265380859375, 0.6259740591049194],
//     [0.35298871994018555, 0.594894528388977],
//     [0.35470905900001526, 0.5631847381591797],
//     [0.3590857684612274, 0.5380555391311646],
//     [0.3667783737182617, 0.5149739384651184],
//     [0.37868133187294006, 0.4971347451210022],
//     [0.3973395824432373, 0.4863966703414917],
//     [0.41754668951034546, 0.4818713068962097],
//   ],
// };

export const fm_xMinFromCoords = (coords) => Math.min(...coords.map((coord) => coord[0]));
export const fm_xMaxFromCoords = (coords) => Math.max(...coords.map((coord) => coord[0]));
export const fm_yMinFromCoords = (coords) => Math.min(...coords.map((coord) => coord[1]));
export const fm_yMaxFromCoords = (coords) => Math.max(...coords.map((coord) => coord[1]));

export const fm_drawPoint = (x, y, widthImg, heightImg, canvas, clr = 'black', sizePx = 5) => {
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(x * widthImg, y * heightImg, sizePx / 2, 0, 2 * Math.PI);
  ctx.fillStyle = clr;
  ctx.fill();
};

// coords = [x_min, y_min, x_max, y_max]
export const fm_drawBB = (
  xMin,
  yMin,
  xMax,
  yMax,
  widthImg,
  heightImg,
  canvas,
  fill,
  clrEdge = 'yellow',
  clrFill = 'yellow',
) => {
  const ctx = canvas.getContext('2d');
  const x = xMin * widthImg;
  const y = yMin * heightImg;
  const w = (xMax - xMin) * widthImg;
  const h = (yMax - yMin) * heightImg;
  if (fill) {
    ctx.fillStyle = clrFill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = clrEdge;
  ctx.strokeRect(x, y, w, h);
};

export const fm_drawContour = (
  coords,
  widthImg,
  heightImg,
  canvas,
  fill,
  clrEdge = 'blue',
  clrFill = 'rgba(13, 110, 253, 0.5)',
) => {
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  coords.forEach(([x, y], i) => {
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x * widthImg, y * heightImg);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = clrFill;
    ctx.fill();
  }
  ctx.strokeStyle = clrEdge;
  ctx.stroke();
};

// eslint-disable-next-line arrow-body-style
export const fm_indsPairToCoords = (landmarks, indsPair) => {
  return indsPair.map((index) => {
    const point = landmarks[index[0]];
    return [point.x, point.y];
  });
};

// eslint-disable-next-line arrow-body-style
export const fm_indsToCoords = (landmarks, inds) => {
  return inds.map((index) => {
    const point = landmarks[index];
    return [point.x, point.y];
  });
};

export const fm_calcCentroid = (coords) => {
  let sumX = 0;
  let sumY = 0;

  coords.forEach((coord) => {
    sumX += coord[0];
    sumY += coord[1];
  });

  return [sumX / coords.length, sumY / coords.length];
};

export const fm_calcAreaPolygon = (coords) => {
  let area = 0;

  for (let i = 0; i < coords.length; i += 1) {
    const j = (i + 1) % coords.length;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  return Math.abs(area / 2);
};

// TODO: careful - what if it is intersecting the vertices!!! - we will get wrong winding number...
export const fm_isPointInsidePolygon = (point, coords) => {
  let inside = false;
  const x = point[0];
  const y = point[1];
  const numCoords = coords.length;
  for (let i = 0; i < numCoords; i += 1) {
    const j = (i - 1) % numCoords;
    const xi = coords[i][0];
    const yi = coords[i][1];
    const xj = coords[j][0];
    const yj = coords[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// ==============================================================
// HT MERTICS
// ==============================================================

export function fm_calcMetricsHead(coordsHead) {
  if (!coordsHead) {
    return null;
  }
  const xMin = fm_xMinFromCoords(coordsHead);
  const xMax = fm_xMaxFromCoords(coordsHead);
  const yMin = fm_yMinFromCoords(coordsHead);
  const yMax = fm_yMaxFromCoords(coordsHead);

  return {
    widthHead: xMax - xMin,
    heightHead: yMax - yMin,
    xCenterHead: (xMin + xMax) / 2,
    yCenterHead: (yMin + yMax) / 2,
    xCentroidHead: fm_calcCentroid(coordsHead)[0],
    yCentroidHead: fm_calcCentroid(coordsHead)[1],
  };
}

export const fm_def_beforeSendToFm = () => {
  if (state.collectSnapshots && state.timeResFm) {
    const snapshot = et_stateSnapshot(state.paramsSnapshot);
    state.snapshots.push(snapshot);
  }
  et_stateResetOngoing();
  state.xyTargFm = state.xyTarg;
  state.timeCur = Date.now();
  state.timeStartFm = Date.now();
};

// TODO: it seems to help with concurrent calls, but understand better!
export async function fm_fmRun() {
  if (!state.continueProcessing) {
    return;
  }
  fm_def_beforeSendToFm();
  await state.faceMesh.send({ image: state.videoIn });
  setTimeout(fm_fmRun, 0);
}

export const fm_loadMediaPipe = () =>
  new Promise((resolve, reject) => {
    if (window.FaceMesh) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `${ET.FM.URL_BASE}/${ET.FM.NAME_FILE_SCRIPT}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

export const paramsFmInitDef = {
  selfieMode: true,
  enableFaceGeometry: false, // TODO: does not work with true
  minDetectionConfidence: ET.FM.CONF_DETECT_MIN,
  minTrackingConfidence: ET.FM.CONF_TRACK_MIN,
};

// TODO: attaches faceMesh to window!!!!!!!!! should export from the file
export const fm_fmInit = (params) => {
  state.faceMesh = new window.FaceMesh({
    locateFile: (nameFile) => `${ET.FM.URL_BASE}/${nameFile}`,
  });
  state.faceMesh.setOptions({
    selfieMode: params.selfieMode,
    enableFaceGeometry: params.enableFaceGeometry,
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: params.minDetectionConfidence,
    minTrackingConfidence: params.minTrackingConfidence,
  });
};

export const t_et_fmInit = (paramsIn = {}) => {
  const params = { ...paramsFmInitDef, ...paramsIn };

  return {
    type: jsPsychCallFunction,
    func: async (done) => {
      await fm_loadMediaPipe();
      fm_fmInit(params);
      done();
    },
    async: true,
  };
};

export const fm_def_fillStateOnResultsFm = (resFm) => {
  if (!resFm.multiFaceLandmarks || resFm.multiFaceLandmarks.length === 0) {
    et_stateResetOngoing(); // needed because snapshot is collected at the beginning of the next iteration - handle lost face correctly
    return;
  }
  // TODO: think whether it is OK to override time here -
  //  it guarantees saving the time, but a bit delayed compared to
  //  actual frame...
  state.timeResFm = new Date().getTime();
  state.landmarks = resFm.multiFaceLandmarks;

  resFm.multiFaceLandmarks.forEach((fmLandmarks) => {
    // --- image
    state.img = resFm.image;
    state.widthImg = resFm.image.width;
    state.heightImg = resFm.image.height;

    // --- iris
    state.coordsIrisL = fm_indsPairToCoords(fmLandmarks, FM_CONT_IRIS_L);
    state.coordsIrisR = fm_indsPairToCoords(fmLandmarks, FM_CONT_IRIS_R);
    state.metricsIris = {
      widthIrisL: fm_xMaxFromCoords(state.coordsIrisL) - fm_xMinFromCoords(state.coordsIrisL),
      widthIrisR: fm_xMaxFromCoords(state.coordsIrisR) - fm_xMinFromCoords(state.coordsIrisR),
    };

    // // --- viewing distance
    // if (state.cal.vdCalibrated) {
    //   state.vdCur = et_vdCalcVd(state.metricsIris.widthIrisL,
    //     state.metricsIris.widthIrisR,
    //     state.cal.vd.flNorm,
    //     state.widthImg,
    //     state.heightImg
    //   );
    // }

    // --- head
    state.coordsHead = fm_indsPairToCoords(fmLandmarks, FM_CONT_HEAD);
    state.metricsHead = fm_calcMetricsHead(state.coordsHead);

    // --- eye: contours & metrics
    state.coordsEyeL = fm_indsToCoords(fmLandmarks, FM_PNTS_EYE_L);
    state.coordsEyeR = fm_indsToCoords(fmLandmarks, FM_PNTS_EYE_R);

    // eslint-disable-next-line no-restricted-syntax
    for (const [coords, canvasNative, canvasScaled] of [
      [state.coordsEyeL, state.canvasNativeEyeL, state.canvasScaledEyeL],
      [state.coordsEyeR, state.canvasNativeEyeR, state.canvasScaledEyeR],
    ]) {
      const xMinEye = fm_xMinFromCoords(coords) * state.widthImg;
      const yMinEye = fm_yMinFromCoords(coords) * state.heightImg;
      const widthEye = (fm_xMaxFromCoords(coords) - fm_xMinFromCoords(coords)) * state.widthImg;
      const heightEye = (fm_yMaxFromCoords(coords) - fm_yMinFromCoords(coords)) * state.heightImg;

      if (canvasNative) {
        canvasNative.width = widthEye;
        canvasNative.height = heightEye;
        const contextNative = canvasNative.getContext('2d', {
          willReadFrequently: true,
        });
        contextNative.save();
        contextNative.translate(widthEye, 0);
        contextNative.scale(-1, 1);
        contextNative.drawImage(resFm.image, xMinEye, yMinEye, widthEye, heightEye, 0, 0, widthEye, heightEye);
        contextNative.restore();
      }

      if (canvasScaled) {
        canvasScaled.width = ET.ET.SIZE_IMG_EYE_MODEL;
        canvasScaled.height = ET.ET.SIZE_IMG_EYE_MODEL;
        const contextScaled = canvasScaled.getContext('2d', {
          willReadFrequently: true,
        });
        contextScaled.drawImage(canvasNative, 0, 0, ET.ET.SIZE_IMG_EYE_MODEL, ET.ET.SIZE_IMG_EYE_MODEL);
      }
    }
  });
};
