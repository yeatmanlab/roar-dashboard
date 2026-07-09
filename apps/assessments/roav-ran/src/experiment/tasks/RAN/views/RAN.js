/**
 * @fileoverview module to support RANView.js
 * @module RAN
 */

/**
 * Number of rows in the grid.
 * @type {number}
 */
export var numRows = 5;

/**
 * Number of columns in the grid.
 * @type {number}
 */
export var numCols = 10;

/**
 * Default width of the screen in centimeters.
 * @type {number}
 */
export var gridWidthCM = 24.75;

/**
 * Default height of the screen in centimeters.
 * @type {number}
 */
export var gridHeightCM = 13;

/**
 * Generates grid coordinates based on device configuration.
 * @param {Object} deviceConfig - Device configuration object.
 * @returns {Array<Object>} Array of cell coordinates and dimensions.
 */
export function generateGridCoordinates(deviceConfig) {
  let cellWidthPX, cellHeightPX, gridWidthPX, gridHeightPX;

  let screenWidthPx = window.visualViewport?.width ?? window.innerWidth;
  let screenHeightPx = window.visualViewport?.height ?? window.innerHeight;

  let totalGridWidthPX = screenWidthPx * 0.8; // 80% of screen width
  let totalGridHeightPX = screenHeightPx * 0.8;

  if (type === "Practice") {
    totalGridWidthPX = screenWidthPx * 0.4; // 50% of screen width for practice
    totalGridHeightPX = screenHeightPx * 0.6;
  }

  cellWidthPX = totalGridWidthPX / numCols;
  cellHeightPX = totalGridHeightPX / numRows;
  // Calculate the total width and height of the grid in pixels
  gridWidthPX = cellWidthPX * numCols;
  gridHeightPX = cellHeightPX * numRows;

  // Calculate the starting point (top-left corner) of the grid to center it on the screen
  const startX = (screenWidthPx - gridWidthPX) / 2;
  const startY = (screenHeightPx - gridHeightPX) / 2;

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
  // console.log("cellCoordinates", cellCoordinates);
  return cellCoordinates;
}

/**
 * Generates a shuffled order of stimuli for the test.
 * @param {Object} testConfig - Test configuration object.
 * @returns {Array<string>} Shuffled array of stimulus names.
 */
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
    }
  }

  return shuffledImages.slice(0, totalGrid);
}

/**
 * Generates 9 practice stimuli from the unique stimuli in testConfig,
 * ensuring no two adjacent stimuli (in reading order) are the same.
 * @param {Object} testConfig - Test configuration object.
 * @returns {Array<string>} Array of 9 stimulus filenames.
 */
export function generatePracticeStimuli(testConfig) {
  const uniqueStimuli = [...new Set(testConfig.stimulus)];
  const total = 9;
  const result = [];
  while (result.length < total) {
    const last = result[result.length - 1];
    const available = uniqueStimuli.filter((s) => s !== last);
    result.push(available[Math.floor(Math.random() * available.length)]);
  }
  return result;
}

/**
 * Populates the grid with stimuli images.
 * @param {Array<Object>} coordinates - Array of cell coordinates.
 * @param {Array<string>} shuffledImages - Array of shuffled stimulus names.
 * @param {Object} testConfig - Test configuration object.
 */
export function populateGrid(coordinates, shuffledImages, testConfig) {
  const gridContainer = document.getElementById("grid-container"); // replace 'grid-container' with the actual ID of your container
  gridContainer.innerHTML = "";

  if (type === "Practice") {
    numCols = 3;
    numRows = 3;
    // Use the same per-cell size as the test grid (gridWidthCM/10 × gridHeightCM/5)
    // so practice stimuli appear at the same scale, just in a smaller 3×3 arrangement
    gridWidthCM = (24.75 / 10) * 3;
    gridHeightCM = (13 / 5) * 3;
    coordinates = generateGridCoordinates(deviceConfig);
    shuffledImages = generatePracticeStimuli(testConfig);
  } else {
    numCols = 10;
    numRows = 5;
    gridWidthCM = 24.75;
    gridHeightCM = 13;
    coordinates = generateGridCoordinates(deviceConfig);
  }

  const totalGrid = numRows * numCols;

  for (let i = 0; i < totalGrid; i++) {
    const cell = document.createElement("div");
    const { x, y, width, height } = coordinates[i];
    cell.style.width = `${width}px`;
    cell.style.height = `${height}px`;
    cell.style.left = `${x}px`; // Adjust for half of the cell width
    cell.style.top = `${y}px`; // Adjust for half of the cell height
    cell.style.position = "absolute"; // Ensure the position is set to absolute
    cell.style.transform = "translate(-50%, -50%)"; // Center the content within the element
    cell.style.display = "flex"; // Set display to flex to use flexbox properties
    cell.style.justifyContent = "center"; // Center horizontally
    cell.style.alignItems = "center"; // Center vertically

    const randomStimulus = shuffledImages[i];
    const stim = document.createElement("img");
    stim.src = `${testConfig.dir}/${randomStimulus}`;
    stim.style.width = "50%"; // Make the image fill the cell
    stim.style.height = "auto"; // Maintain aspect ratio
    // stim.style.height = '75%';

    cell.appendChild(stim);
    gridContainer.appendChild(cell);
    const stimPosition = stim.getBoundingClientRect();
    stimPosition.x = stimPosition.x + stimPosition.width / 2;
    stimPosition.y = stimPosition.y + stimPosition.height / 2;
    const gridCoordinatesObject = {
      x: parseFloat(cell.style.left),
      y: parseFloat(cell.style.top),
      width: parseFloat(cell.style.width),
      height: parseFloat(cell.style.height),
      stim_x: stimPosition.x,
      stim_y: stimPosition.y,
      stim_width: stimPosition.width,
      stim_height: stimPosition.height,
    };

    _gridCoordinates.push(gridCoordinatesObject);
    _shuffledImages.push(randomStimulus.slice(0, -4));
  }
}

/**
 * Starts the test, including eye tracking if enabled.
 * @param {boolean} bEyeTracking - Whether to enable eye tracking.
 */
export async function startTest(bEyeTracking) {
  if (bEyeTracking) {
    try {
      await waitForVideoReady();
      continueProcessing = true;
      runInference();
    } catch (error) {
      console.warn(
        "Eye tracking inference failed, continuing without eye tracking:",
        error,
      );
      continueProcessing = false;
    }
  }

  openFullscreen();
  startRecording();
  populateGrid(gridCoordinates, shuffledImages, testConfig);
  updateCountdown();
  // Enable the button after a 3-second delay
  setTimeout(function () {
    document.querySelector(".finish-button").disabled = false;
  }, 5000);
}

/**
 * Waits for the video stream to be ready with at least one frame.
 * @returns {Promise<void>}
 */
export async function waitForVideoReady() {
  return new Promise((resolve) => {
    const checkVideo = () => {
      if (
        inputVideo &&
        inputVideo.videoWidth > 0 &&
        inputVideo.videoHeight > 0
      ) {
        resolve();
      } else {
        setTimeout(checkVideo, 100);
      }
    };
    checkVideo();
  });
}

/**
 * Countdown value for the test start.
 * @type {number}
 */
export var countdown = 4;

/**
 * Updates the countdown and executes a callback when it reaches zero.
 * @param {Function} [callbackFunction] - Function to call when countdown reaches zero.
 */
export function updateCountdown(callbackFunction) {
  countdown--;

  if (countdown == 0) {
    document.getElementById("instruction").style.display = "none";
    document.getElementById("grid-container").style.visibility = "visible";
    countdown = 4;
    trialRunnning = true;
  } else {
    document.getElementById("instruction").innerHTML =
      "<h1>" + countdown + "</h1>";
    setTimeout(function () {
      updateCountdown(callbackFunction);
    }, 1000);
  }
}
