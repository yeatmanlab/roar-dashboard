export var _pageCompleted = false;

export var numRows = 4;
export var numCols = 9;

export var gridWidthCM = 24.75;
export var gridHeightCM = 13;
export var videoChunks = [];

export function generateGridCoordinates(deviceConfig) {
  let cellWidthPX, cellHeightPX, gridWidthPX, gridHeightPX;
  console.log(
    deviceConfig.screenWidth,
    deviceConfig.screenHeight,
    deviceConfig.screenWidthPX,
    deviceConfig.screenHeightPX,
  );
  if (deviceConfig.screenWidth > 0 && deviceConfig.screenHeight > 0) {
    // Convert centimeters to pixels
    const cellWidthCM = gridWidthCM / numCols;
    const cellHeightCM = gridHeightCM / numRows;
    cellWidthPX =
      cellWidthCM * (deviceConfig.screenWidthPX / deviceConfig.screenWidth);
    cellHeightPX =
      cellHeightCM * (deviceConfig.screenHeightPX / deviceConfig.screenHeight);
  } else {
    // Fallback to using 80% of screen width and calculate height to maintain aspect ratio
    const totalGridWidthPX = deviceConfig.screenWidthPX * 0.8; // 80% of screen width
    const totalGridHeightPX = deviceConfig.screenHeightPX * 0.8;
    cellWidthPX = totalGridWidthPX / numCols;
    cellHeightPX = totalGridHeightPX / numRows;
  }

  // Calculate the total width and height of the grid in pixels
  gridWidthPX = cellWidthPX * numCols;
  gridHeightPX = cellHeightPX * numRows;

  // Calculate the starting point (top-left corner) of the grid to center it on the screen
  const startX = (deviceConfig.screenWidthPX - gridWidthPX) / 2;
  const startY = (deviceConfig.screenHeightPX - gridHeightPX) / 2;

  // Generate and store the coordinates of the center of each cell
  const cellCoordinates = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const centerX = startX + col * cellWidthPX + cellWidthPX / 2;
      const centerY = startY + row * cellHeightPX + cellHeightPX / 2;
      cellCoordinates.push({
        x: centerX,
        y: centerY,
        width: cellWidthPX,
        height: cellHeightPX,
      });
    }
  }

  // Shuffle the cellCoordinates array using Fisher-Yates algorithm
  for (let i = cellCoordinates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cellCoordinates[i], cellCoordinates[j]] = [
      cellCoordinates[j],
      cellCoordinates[i],
    ];
  }

  return cellCoordinates;
}

// function generateGridCoordinates(deviceConfig) {

//   const cellWidthCM = gridWidthCM / numCols;
//   const cellHeightCM = gridHeightCM / numRows;

//   const cellWidthPX = cellWidthCM * (deviceConfig.screenWidthPX / deviceConfig.screenWidth);
//   const cellHeightPX = cellHeightCM * (deviceConfig.screenHeightPX / deviceConfig.screenHeight);

//   // Calculate the total width and height of the grid in pixels
//   const gridWidthPX = cellWidthPX * numCols;
//   const gridHeightPX = cellHeightPX * numRows;

//   // Calculate the starting point (top-left corner) of the grid to center it on the screen
//   const startX = (deviceConfig.screenWidthPX - gridWidthPX) / 2;
//   const startY = (deviceConfig.screenHeightPX - gridHeightPX) / 2;

//   // Generate and store the coordinates of the center of each cell
//   const cellCoordinates = [];
//   for (let row = 0; row < numRows; row++) {
//       for (let col = 0; col < numCols; col++) {
//           const centerX = startX + col * cellWidthPX + cellWidthPX / 2;
//           const centerY = startY + row * cellHeightPX + cellHeightPX / 2;
//           cellCoordinates.push({ x: centerX, y: centerY, width: cellWidthPX , height: cellHeightPX });
//       }
//   }

//   // Shuffle the cellCoordinates array using Fisher-Yates algorithm
//   for (let i = cellCoordinates.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [cellCoordinates[i], cellCoordinates[j]] = [cellCoordinates[j], cellCoordinates[i]];
//   }

//   return cellCoordinates;
// }

// function generateStimulusOrder(testConfig) {
//   const totalGrid = numRows * numCols;
//   const images = testConfig['stimulus'].slice(); // Create a copy of the array to avoid modifying the original
//   const numImages = images.length;
//   const numSets = Math.ceil(totalGrid / numImages);

//   // Create 4 shuffled copies of the images array
//   const shuffledSets = Array.from({ length: numSets }, () => {
//       const shuffledImages = [...images];
//       for (let i = shuffledImages.length - 1; i > 0; i--) {
//           const j = Math.floor(Math.random() * (i + 1));
//           [shuffledImages[i], shuffledImages[j]] = [shuffledImages[j], shuffledImages[i]];
//       }
//       return shuffledImages;
//   });

//   // Concatenate the shuffled sets to get a diverse set of images
//   const shuffledImages = [].concat(...shuffledSets);

//   return shuffledImages.slice(0, totalGrid);
// }

export function generateStimulusOrder(testConfig) {
  const totalGrid = numRows * numCols;
  const images = testConfig.stimulus.slice(); // Create a copy of the array to avoid modifying the original

  // Calculate the number of sets needed
  const numSets = Math.ceil(totalGrid / images.length);

  // Create an array to hold the shuffled images
  const shuffledImages = [];

  // Append shuffled copies of images to create sets
  for (let i = 0; i < numSets; i++) {
    // Shuffle the images array
    const shuffled = images.sort(() => Math.random() - 0.5);
    shuffledImages.push(...shuffled);
  }

  // Replace duplicate adjacent elements
  for (let i = 1; i < shuffledImages.length; i++) {
    if (shuffledImages[i] === shuffledImages[i - 1]) {
      // Replace with the letter before it
      const hold = shuffledImages[i];
      shuffledImages[i] = shuffledImages[i + 1];
      shuffledImages[i + 1] = hold;
      String.fromCharCode(shuffledImages[i].charCodeAt(0) - 1);
    }
  }

  return shuffledImages.slice(0, totalGrid);
}

export async function giveAccess() {
  try {
    // Request the user's media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
      },
      audio: true,
    });

    // Assign the camera stream to a global variable
    camera_stream = stream;

    // Check if the stream is active
    if (camera_stream && camera_stream.active) {
      // Additional setup such as disabling buttons or initializing recorders
      // document.getElementById("giveAccessButton").disabled = true;
      videoChunks = [];
      videoRecorder = new MediaRecorder(camera_stream);
      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };

      // videoRecorder and other setups can be initialized here
      return Promise.resolve(camera_stream); // Resolve the promise with the stream
    } else {
      // If stream is not active, throw an error
      throw new Error("Camera stream is not active");
    }
  } catch (error) {
    console.error("Error accessing media devices:", error);
    return Promise.reject(error); // Reject the promise if there is an error
  }
}

export async function startTest(callbackFunction) {
  await giveAccess();
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
