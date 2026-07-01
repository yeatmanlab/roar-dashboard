import ndarray from "ndarray";
import ops from "ndarray-ops";
import Worker from "web-worker";
import {
  FaceMesh,
  FACEMESH_LEFT_IRIS,
  FACEMESH_RIGHT_IRIS,
  FACEMESH_FACE_OVAL,
} from "@mediapipe/face_mesh";

export const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
  },
});

export function onResultsFaceMesh(results) {
  var leftEyeCoor = [];
  var rightEyeCoor = [];
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      const indicesLeft = [130, 27, 243, 23];
      indicesLeft.forEach((index) => {
        const point = landmarks[index];
        leftEyeCoor.push([point.x, point.y]);
      });
      const indicesRight = [463, 257, 359, 253];
      indicesRight.forEach((index) => {
        const point = landmarks[index];
        rightEyeCoor.push([point.x, point.y]);
      });
    }
  }

  leftEyeCoordinates = leftEyeCoor;
  rightEyeCoordinates = rightEyeCoor;
}

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onResultsFaceMesh);

export var _pageCompleted = false;
export var myWorker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});

export async function giveAccess() {
  try {
    // Get the user's media (audio and video)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
      },
      audio: true,
    });

    inputVideo.srcObject = stream;
    inputVideo.addEventListener("loadedmetadata", () => {
      orig_img_width = inputVideo.videoWidth;
      orig_img_height = inputVideo.videoHeight;
    });
    inputVideo.play();

    // Initialize the MediaRecorder
    videoRecorder = new MediaRecorder(stream);

    videoRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        videoChunks.push(event.data);
      }
    };
    videoRecorder.onstop = async () => {
      console.log("Recording stopped, blob created");
    };
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

export async function startTest(callbackFunction) {
  await runInference();
  openFullscreen();
  updateCountdown(callbackFunction);
}

export var countdown = 4;
export function updateCountdown(callbackFunction) {
  countdown--;

  if (countdown === 0) {
    document.getElementById("instruction").style.display = "none";
    if (typeof callbackFunction === "function") {
      callbackFunction();
      countdown = 4;
    }
  } else {
    document.getElementById("instruction").innerHTML =
      "<h1>" + countdown + "</h1>";
    setTimeout(function () {
      updateCountdown(callbackFunction);
    }, 1000);
  }
}

export function openFullscreen() {
  if (desktop.requestFullscreen) {
    desktop.requestFullscreen();
  } else if (desktop.webkitRequestFullscreen) {
    /* Safari */
    desktop.webkitRequestFullscreen();
  } else if (desktop.msRequestFullscreen) {
    /* IE11 */
    desktop.msRequestFullscreen();
  }
}

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
