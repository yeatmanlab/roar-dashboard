import {
  FaceMesh,
  FACEMESH_LEFT_IRIS,
  FACEMESH_RIGHT_IRIS,
  FACEMESH_FACE_OVAL,
} from "@mediapipe/face_mesh";

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

    // Assign the camera stream to the inputVideo element
    if (inputVideo) {
      inputVideo.srcObject = stream;
      inputVideo.play();

      // Set the canvas dimensions to match the video stream
      // Listen for the 'loadedmetadata' event to ensure video metadata is available
      inputVideo.addEventListener("loadedmetadata", function () {
        // Set the canvas dimensions to match the video stream
        if (frameCanvas) {
          const { width, height } = {
            width: inputVideo.videoWidth,
            height: inputVideo.videoHeight,
          };
          frameCanvas.width = width;
          frameCanvas.height = height;
        }
      });
    } else {
      console.error("inputVideo element not found.");
    }
  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

export async function processFrames() {
  // Check if inputVideo is defined
  if (inputVideo) {
    try {
      await faceMesh.send({ image: inputVideo });
    } catch (error) {
      console.error("Error sending frame to FaceMesh:", error);
    }

    if (continueProcessing) {
      requestAnimationFrame(processFrames);
    }
  } else {
    console.error("inputVideo element not found.");
  }
}

export var solutionOptions = {
  selfieMode: true,
  enableFaceGeometry: false,
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export function onResultsFaceMesh(results) {
  var width = results.image.width;
  var height = results.image.height;
  var irisLeftMinX = -1;
  var irisLeftMaxX = -1;
  var irisRightMinX = -1;
  var irisRightMaxX = -1;
  var leftEyeCoor = [];
  var rightEyeCoor = [];
  var headCoor = [];
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      for (const point of FACEMESH_LEFT_IRIS) {
        var point0 = landmarks[point[0]];
        if (irisLeftMinX == -1 || point0.x * width < irisLeftMinX) {
          irisLeftMinX = point0.x * width;
        }
        if (irisLeftMaxX == -1 || point0.x * width > irisLeftMaxX) {
          irisLeftMaxX = point0.x * width;
        }
      }

      for (const point of FACEMESH_RIGHT_IRIS) {
        var point0 = landmarks[point[0]];
        if (irisRightMinX == -1 || point0.x * width < irisRightMinX) {
          irisRightMinX = point0.x * width;
        }
        if (irisRightMaxX == -1 || point0.x * width > irisRightMaxX) {
          irisRightMaxX = point0.x * width;
        }
      }

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

      canvasCtx.beginPath();
      // Assume FACEMESH_FACE_OVAL is an iterable of landmark indices forming the contour
      FACEMESH_FACE_OVAL.forEach((index, i) => {
        const point = landmarks[index[0]];
        headCoor.push([point.x, point.y]);

        if (i === 0) {
          // Move to the first point without drawing a line
          canvasCtx.moveTo(point.x * width, point.y * height);
        } else {
          // Draw lines to subsequent points
          canvasCtx.lineTo(point.x * width, point.y * height);
        }
      });
      canvasCtx.closePath();

      // Set the fill style and fill the path
      canvasCtx.fillStyle = "rgba(13, 110, 253, 0.5)"; // Semi-transparent blue
      canvasCtx.fill();
    }
  }
  canvasCtx.restore();

  var Leftdx = irisLeftMaxX - irisLeftMinX;
  var Rightdx = irisRightMaxX - irisRightMinX;
  var dX = 11.7;

  if (normalizedFocalLength) {
    var fx = Math.min(width, height) * normalizedFocalLength;
    var leftdZ = (fx * (dX / Leftdx)) / 10.0;
    var rightdZ = (fx * (dX / Rightdx)) / 10.0;

    var dZ = (leftdZ + rightdZ) / 2;
    dZ = dZ.toFixed(0);
    current_viewingDistance = dZ;
  }

  focalLengthMultiple = Math.min(width, height);
  irisMetrics = { widthLeftIris: Leftdx, widthRightIris: Rightdx };
  headMetrics = calculateHeadMetrics(headCoor);
  headCoordinates = headCoor;
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
export function estimateDistance() {
  if (current_viewingDistance > 0) {
    viewingDistanceElement.textContent = `Estimated Distance: ${current_viewingDistance}cm`;
  }
}

export const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
  },
});

faceMesh.setOptions(solutionOptions);
faceMesh.onResults(onResultsFaceMesh);
