var solutionOptions = {
  selfieMode: true,
  enableFaceGeometry: false,
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

function onResultsFaceMesh(results) {
  var width = results.image.width;
  var height = results.image.height;
  var irisLeftMinX = -1;
  var irisLeftMaxX = -1;
  var irisRightMinX = -1;
  var irisRightMaxX = -1;
  var leftEyeCoor = [];
  var rightEyeCoor = [];
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
  // canvasCtx.drawImage(
  //     results.image, 0, 0, frameCanvas.width, frameCanvas.height);

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

      canvasCtx.beginPath();

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

      // Assume FACEMESH_FACE_OVAL is an iterable of landmark indices forming the contour
      FACEMESH_FACE_OVAL.forEach((index, i) => {
        const point = landmarks[index[0]];
        if (i === 0) {
          // Move to the first point without drawing a line
          canvasCtx.moveTo(point.x * width, point.y * height);
        } else {
          // Draw lines to subsequent points
          canvasCtx.lineTo(point.x * width, point.y * height);
        }
      });

      // Close the path to connect the last point with the first
      canvasCtx.closePath();

      // Set the fill style and fill the path
      canvasCtx.fillStyle = "rgba(0, 0, 0, 1.0)"; // Semi-transparent grey
      canvasCtx.fill();
    }
  }

  var Leftdx = irisLeftMaxX - irisLeftMinX;
  var Rightdx = irisRightMaxX - irisRightMinX;
  var dX = 11.7;

  // Logitech HD Pro C922	Norm focal
  // var normalizedFocaleX = 1.3 for c920 ; or 1.4 for c922
  // var fx = Math.min(width, height) * normalizedFocaleX;
  // var dZ = (fx * (dX / dx)) / 10.0;

  var fx = Math.min(width, height) * normalizedFocalLength;
  var leftdZ = (fx * (dX / Leftdx)) / 10.0;
  var rightdZ = (fx * (dX / Rightdx)) / 10.0;

  var dZ = (leftdZ + rightdZ) / 2;
  dZ = dZ.toFixed(0);
  current_viewingDistance = dZ;
  canvasCtx.restore();
}

var progress = 0;
function updateUI() {
  const expectedDistance = 50; // Replace with your actual expected distance
  const absoluteDifference = Math.abs(
    current_viewingDistance - expectedDistance,
  );

  // Update the viewing distance display
  // viewingDistanceElement.innerText = `Cur. Viewing Distance: ${current_viewingDistance} cm`;

  // if (current_viewingDistance < expectedDistance - 3) {
  //   viewingDistanceElement.innerText += " - Go Back!";
  // } else if (current_viewingDistance > expectedDistance + 3) {
  //   viewingDistanceElement.innerText += " - Come Closer!";
  // } else {
  //   viewingDistanceElement.innerText += " - Stay There!";
  // }

  // if (absoluteDifference <= 3) {
  //   progress = progress + 5;
  //   if (progress > 100) {
  //     progress = 100;
  //     distanceSet();
  //   }
  //   loadingBar.style.width = `${progress}%`;
  // } else {
  //   progress = progress - 20;
  //   if (progress < 0) {
  //     progress = 0;
  //   }
  //   loadingBar.style.width = `${progress}%`;
  // }
}

var updateInterval = setInterval(updateUI, 100);

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
  },
});

faceMesh.setOptions(solutionOptions);
faceMesh.onResults(onResultsFaceMesh);

// const camera = new Camera(inputVideo, {
//   onFrame: async () => {
//     await faceMesh.send({image: inputVideo});
//   },
//   // width: 480,
//   // height: 480
// });
// camera.start();
