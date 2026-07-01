import ndarray from "ndarray";
import ops from "ndarray-ops";
// import Worker from "web-worker";
// import {
//   FaceMesh,
//   FACEMESH_LEFT_IRIS,
//   FACEMESH_RIGHT_IRIS,
//   FACEMESH_FACE_OVAL,
// } from "@mediapipe/face_mesh";

export var FACEMESH_LEFT_IRIS = [
  [474, 475],
  [475, 476],
  [476, 477],
  [477, 474],
];
export var FACEMESH_RIGHT_IRIS = [
  [469, 470],
  [470, 471],
  [471, 472],
  [472, 469],
];
export var FACEMESH_FACE_OVAL = [
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

// Only for testing
export var defaultDeviceConfig = {
  screenWidth: 30.2,
  screenHeight: 19.6,
  screenWidthPX: 1512,
  screenHeightPX: 892,
  webcamHeight: 2,
  normalizedFocalLength: 1.3,
};

export var defaultParticipantConfig = {
  headCenterX: 0.4383369982242584,
  headCenterY: 0.6562557443976402,
  headHeight: 0.3467509150505066,
  headWidth: 0.17240141332149506,
  widthLeftIris: 29.442644119262695,
  widthRightIris: 29.782133102416992,
  canvasContour: [
    [0.4412970542907715, 0.4813721179962158],
    [0.4646510183811188, 0.4823227524757385],
    [0.48430705070495605, 0.48748111724853516],
    [0.5025681853294373, 0.4987863302230835],
    [0.5136374235153198, 0.5169670581817627],
    [0.5202310681343079, 0.5401103496551514],
    [0.5239146947860718, 0.5652479529380798],
    [0.5248485207557678, 0.5970170497894287],
    [0.5236638784408569, 0.6280523538589478],
    [0.5220870971679688, 0.6599369645118713],
    [0.519332766532898, 0.6945410370826721],
    [0.5138625502586365, 0.7309722304344177],
    [0.5065117478370667, 0.7603253722190857],
    [0.4982540011405945, 0.7814207673072815],
    [0.48702606558799744, 0.7993608713150024],
    [0.4769010543823242, 0.8114907741546631],
    [0.46630799770355225, 0.8215509057044983],
    [0.4544796049594879, 0.8288376331329346],
    [0.4395001232624054, 0.8312488794326782],
    [0.42436403036117554, 0.8285082578659058],
    [0.41225385665893555, 0.8210300207138062],
    [0.40132373571395874, 0.8104891777038574],
    [0.3908883333206177, 0.7982432246208191],
    [0.3792901039123535, 0.7797933220863342],
    [0.3707539737224579, 0.7583227753639221],
    [0.36319053173065186, 0.728979766368866],
    [0.35756009817123413, 0.6924722790718079],
    [0.35495781898498535, 0.6577485203742981],
    [0.35378265380859375, 0.6259740591049194],
    [0.35298871994018555, 0.594894528388977],
    [0.35470905900001526, 0.5631847381591797],
    [0.3590857684612274, 0.5380555391311646],
    [0.3667783737182617, 0.5149739384651184],
    [0.37868133187294006, 0.4971347451210022],
    [0.3973395824432373, 0.4863966703414917],
    [0.41754668951034546, 0.4818713068962097],
  ],
};

export function onResultsFaceMesh(results) {
  const width = results.image.width;
  const height = results.image.height;
  const leftEyeCoor = [];
  const rightEyeCoor = [];
  const headCoor = [];

  let irisLeftMinX = Infinity;
  let irisLeftMaxX = -Infinity;
  let irisRightMinX = Infinity;
  let irisRightMaxX = -Infinity;

  headCtx.save();
  headCtx.clearRect(0, 0, headCanvas.width, headCanvas.height);

  if (results.multiFaceLandmarks) {
    results.multiFaceLandmarks.forEach((landmarks) => {
      processIrisPoints(FACEMESH_LEFT_IRIS, landmarks, width, (iris) => {
        irisLeftMinX = Math.min(irisLeftMinX, iris);
        irisLeftMaxX = Math.max(irisLeftMaxX, iris);
      });

      processIrisPoints(FACEMESH_RIGHT_IRIS, landmarks, width, (iris) => {
        irisRightMinX = Math.min(irisRightMinX, iris);
        irisRightMaxX = Math.max(irisRightMaxX, iris);
      });

      collectCoordinates(landmarks, [130, 27, 243, 23], leftEyeCoor);
      collectCoordinates(landmarks, [463, 257, 359, 253], rightEyeCoor);

      if (typeof canvasContour !== "undefined" && canvasContour) {
        var path1 = drawContour(
          canvasContour,
          headCtx,
          width,
          height,
          "rgba(13, 110, 253, 1.0)",
          3,
          "transparent",
        );
        fixedContour = path1;
      }
      var path2 = drawFaceOval(
        FACEMESH_FACE_OVAL,
        landmarks,
        headCtx,
        width,
        height,
        headCoor,
      );
      movingContour = path2;
    });
  }

  headCtx.restore();

  if (normalizedFocalLength > 0) {
    const leftdZ = calculateDepth(
      width,
      height,
      11.7,
      irisLeftMaxX - irisLeftMinX,
      normalizedFocalLength,
    );
    const rightdZ = calculateDepth(
      width,
      height,
      11.7,
      irisRightMaxX - irisRightMinX,
      normalizedFocalLength,
    );
    const dZ = ((leftdZ + rightdZ) / 2).toFixed(0);
    current_viewingDistance = dZ;
  }

  focalLengthMultiple = Math.min(width, height);
  irisMetrics = {
    widthLeftIris: irisLeftMaxX - irisLeftMinX,
    widthRightIris: irisRightMaxX - irisRightMinX,
  };
  headMetrics = calculateHeadMetrics(headCoor);
  leftEyeCoordinates = leftEyeCoor;
  rightEyeCoordinates = rightEyeCoor;
  headCoordinates = headCoor;
}

function processIrisPoints(irisPoints, landmarks, width, callback) {
  irisPoints.forEach((point) => {
    const irisX = landmarks[point[0]].x * width;
    callback(irisX);
  });
}

function collectCoordinates(landmarks, indices, coordinates) {
  indices.forEach((index) => {
    const point = landmarks[index];
    coordinates.push([point.x, point.y]);
  });
}

function drawContour(
  points,
  ctx,
  width,
  height,
  strokeStyle,
  lineWidth,
  fillStyle,
) {
  if (!points) return;
  const path1 = [];
  const path = points.map((point) => [point[0] * width, point[1] * height]);
  ctx.beginPath();
  path.forEach(([x, y], index) => {
    path1.push([x, y]);
    ctx[index === 0 ? "moveTo" : "lineTo"](x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = fillStyle;
  ctx.stroke();
  return path1;
}

function drawFaceOval(ovalIndices, landmarks, ctx, width, height, coordinates) {
  const path = ovalIndices.map((index) => {
    const point = landmarks[index[0]];
    coordinates.push([point.x, point.y]);
    return [point.x * width, point.y * height];
  });
  const path2 = [];
  ctx.beginPath();
  path.forEach(([x, y], i) => {
    path2.push([x, y]);
    ctx[i === 0 ? "moveTo" : "lineTo"](x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(13, 110, 253, 1.0)"; // Semi-transparent blue

  // ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
  ctx.fill();
  return path2;
}

function calculateDepth(
  imageWidth,
  imageHeight,
  dX,
  dWidth,
  normalizedFocalLength,
) {
  const fx = Math.min(imageWidth, imageHeight) * normalizedFocalLength;
  return (fx * (dX / dWidth)) / 10.0;
}

export function calculateHeadMetrics(headCoor) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Iterate over each coordinate pair in headCoor array
  headCoor.forEach((coor) => {
    minX = Math.min(minX, coor[0]); // Find the smallest x value
    maxX = Math.max(maxX, coor[0]); // Find the largest x value
    minY = Math.min(minY, coor[1]); // Find the smallest y value
    maxY = Math.max(maxY, coor[1]); // Find the largest y value
  });

  // Calculate the width, height, and center coordinates
  const headWidth = maxX - minX;
  const headHeight = maxY - minY;
  const headCenterX = (minX + maxX) / 2;
  const headCenterY = (minY + maxY) / 2;

  // Return the metrics as an object
  return {
    headWidth: headWidth,
    headHeight: headHeight,
    headCenterX: headCenterX,
    headCenterY: headCenterY,
  };
}

export function initEyeTracking(showEyes = false, showGaze = false) {
  blueCircle = window.document.createElement("div");
  blueCircle.setAttribute("id", "blueCircle");
  blueCircle.style.position = "absolute";
  blueCircle.style.width = "20px";
  blueCircle.style.height = "20px";
  blueCircle.style.backgroundColor = "blue";
  blueCircle.style.borderRadius = "50%";
  blueCircle.style.transform = "translate(-50%, -50%)";
  blueCircle.style.display = "none"; // Hide the canvas initially
  document.body.appendChild(blueCircle);

  const leftEye = document.createElement("canvas");
  leftEye.setAttribute("id", "leftEye");
  leftEye.setAttribute("width", "128");
  leftEye.setAttribute("height", "128");
  leftEye.style.position = "absolute"; // Positioning it absolutely
  leftEye.style.top = "0"; // Top of the viewport
  leftEye.style.left = "0"; // Left of the viewport
  leftEye.style.display = "none"; // Hide the canvas initially
  document.body.appendChild(leftEye);

  const rightEye = document.createElement("canvas");
  rightEye.setAttribute("id", "rightEye");
  rightEye.setAttribute("width", "128");
  rightEye.setAttribute("height", "128");
  rightEye.style.position = "absolute"; // Positioning it absolutely
  rightEye.style.top = "0"; // Top of the viewport
  rightEye.style.left = "128px"; // Immediately to the right of the leftEye
  rightEye.style.display = "none"; // Hide the canvas initially
  document.body.appendChild(rightEye);

  // If verbose is true, set all canvas displays to block (visible)
  if (showEyes) {
    leftEye.style.display = "block";
    rightEye.style.display = "block";
  }
  if (showGaze) {
    blueCircle.style.display = "block";
  }

  leftEyectx = leftEye.getContext("2d", { willReadFrequently: true });
  rightEyectx = rightEye.getContext("2d", { willReadFrequently: true });
}

// export const faceMesh = new FaceMesh({
//   locateFile: (file) => {
//     return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
//   },
// });

// faceMesh.setOptions({
//   selfieMode: true,
//   enableFaceGeometry: false,
//   maxNumFaces: 1,
//   refineLandmarks: true,
//   minDetectionConfidence: 0.5,
//   minTrackingConfidence: 0.5,
// });

// faceMesh.onResults(onResultsFaceMesh);
// export var myWorker = new Worker(new URL("./worker.js", import.meta.url), {
//   type: "module",
// });

export function preprocess(data, width, height) {
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

export function preprocess_kps(data, width, height) {
  const dataFromImage = ndarray(new Float32Array(data), [data.length]);
  const dataProcessed = ndarray(new Float32Array(data.length), [
    1,
    data.length,
  ]);
  ops.assign(dataProcessed.pick(0, null), dataFromImage);

  return new Float32Array(dataProcessed.data);
}

export function convertToYolo(feature, w, h) {
  let centerx = (feature[0][0] + feature[2][0]) / 2.0;
  let centery = (feature[1][1] + feature[3][1]) / 2.0;
  let width = feature[2][0] - feature[0][0];
  let height = feature[3][1] - feature[1][1];
  let box = [centerx, centery, width, height];
  let upper_left_x = (box[0] - box[2] / 2) * w;
  let upper_left_y = (box[1] - box[3] / 2) * h;
  width = box[2] * w;
  height = box[3] * h;
  return [upper_left_x, upper_left_y, width, height];
}

function calculateCentroid(points) {
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < points.length; i++) {
    sumX += points[i][0];
    sumY += points[i][1];
  }

  return [sumX / points.length, sumY / points.length];
}

function calculatePolygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return Math.abs(area / 2);
}

// Check if FACEMESH_FACE_OVAL area is within 80-120% of canvasContour area
export function isAreaWithinRange(path1, path2) {
  const path1Area = calculatePolygonArea(path1);
  const path2Area = calculatePolygonArea(path2);

  return path2Area >= 0.9 * path1Area && path2Area <= 1.1 * path1Area;
}

// Check if the centroid of path2 is inside path1
export function isCentroidInsidePath(path1, path2) {
  const centroid = calculateCentroid(path2);
  return isPointInsidePolygon(centroid, path1);
}

// Function to check if a point is inside a polygon
function isPointInsidePolygon(point, polygon) {
  let inside = false;
  const x = point[0];
  const y = point[1];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
