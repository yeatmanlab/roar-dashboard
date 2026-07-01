import store from "store2";
var testConfig;
let _config;

function checkTestConfig() {
  // Try to get testConfig from the session
  testConfig = store.session.get("testConfig");

  // Check if testConfig and its stimulus property exist
  if (testConfig && testConfig.stimulus) {
    // Once found, clear the interval
    clearInterval(checkInterval);

    // Proceed with your logic here
    // For example: Initialize test using testConfig.stimulus
  }
}

var checkInterval = setInterval(checkTestConfig, 100);

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

export async function giveAccess_audioonly() {
  try {
    // Set media constraints based on whether audio only or audio + video is requested
    const mediaConstraints = { audio: true }; // Only request audio

    console.log("mediaConstraints", mediaConstraints);
    // Request the user's media based on the constraints
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
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

export async function startTest() {
  if (deviceConfig.storeVideo) {
    await giveAccess();
  } else {
    await giveAccess_audioonly();
  }
  voiceover.pause();
  voiceover.currentTime = 0; // Stop the voiceover whenever a click is detected
  openFullscreen();
  updateCountdown(init_newTrial);
}

export var countdown = 4;
export function updateCountdown(callbackFunction) {
  countdown--;
  console.log("countdown", countdown);
  if (countdown == 0) {
    document.getElementById("instruction").style.display = "none";
    document.getElementById("grid-container").style.opacity = "0";
    callbackFunction();
    countdown = 4;
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

// export createBorderStimulus(id,content,x,y){
//   const elem = document.createElement("div");
//   elem.id = id;
//   elem.innerHTML = `<img src="${testConfig.dir}/${content}" style="width: 100%; height: 100%;">`;
//   elem.style.position = "absolute";
//   elem.style.transform = "translate(-50%, -50%)";
//   elem.style.width = stimulusSize.toString() + "px";
//   elem.style.height = "auto";
//   elem.style.left = `${x}px`;
//   elem.style.top = `${y}px`;
//   container.appendChild(elem);
// }

export function stimulusTemplate(
  stim1,
  pos, //1,2,3,4,5,6
  horizontalSpacing_deg = 0.58,
) {
  // Assuming there is a container div with id 'container'
  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.transform = "translate(-50%, -50%)";
  container.innerHTML = ""; // Clear previous contents

  const borderContainer = document.createElement("div");
  borderContainer.style.position = "relative";
  borderContainer.style.width = "100%";
  borderContainer.style.height = "100%";
  borderContainer.style.transform = "translate(-50%, -50%)";
  borderContainer.innerHTML = ""; // Clear previous contents

  // Helper function to create and position elements
  function createStimulus(id, content, x, y, containerType) {
    const elem = document.createElement("div");
    elem.id = id;
    // elem.innerHTML = `<img src="${testConfig.dir}/${content}" style="width: 100%; height: 100%;">`;
    elem.innerHTML = content;
    elem.style.position = "absolute";
    elem.style.transform = "translate(-50%, -50%)";
    elem.style.width = stimulusSize.toString() + "px";
    elem.style.fontSize = "5vh";
    elem.style.height = "auto";
    elem.style.left = `${x}px`;
    elem.style.top = `${y}px`;
    if (containerType === "container") {
      container.appendChild(elem);
    } else {
      borderContainer.appendChild(elem);
    }
  }

  const offsetX = horizontalSpacing_deg * PixelsPerDegree; // arbitrary spacing horizontally

  createStimulus(
    "pos1",
    stim1,
    container.offsetWidth / 2,
    container.offsetHeight / 2,
    "container",
  );

  return {
    container: container,
    borderContainer: borderContainer,
  };
}

export function get_PixelsPerDegree(distanceCM, screenWidthPX, screenWidthCM) {
  var OneCmInDegrees = tanDegrees(0.5) * distanceCM * 2;
  var PixelPerCm = screenWidthPX / screenWidthCM;
  var PixelsPerDegree = OneCmInDegrees * PixelPerCm;
  return PixelsPerDegree;
}

export function get_stimulusSize(size_logmar, multiple, PixelsPerDegree) {
  var size_arcmin = logmar_to_arcmin(size_logmar) * multiple;
  var size_deg = arcmin_to_deg(size_arcmin);
  console.log("degSize", size_deg);
  var size_px = size_deg * PixelsPerDegree;
  return size_px;
}

export function tanDegrees(angleInDegrees) {
  var angleInRadians = angleInDegrees * (Math.PI / 180);
  return Math.tan(angleInRadians);
}

export function logmar_to_arcmin(value) {
  return Math.pow(10, value);
}

export function arcmin_to_deg(value) {
  return value / 60;
}

export function get_lowestSpacingDeg(
  stimulusSizePX,
  PixelsPerDegree,
  minSpacingMultiple,
) {
  var lowestSpacing_px = minSpacingMultiple * stimulusSizePX;
  var lowestSpacing_deg = lowestSpacing_px * (1 / PixelsPerDegree);
  return lowestSpacing_deg;
}

export function createOptions() {
  const container = document.getElementById("container_options");
  const row1 = document.getElementById("row1");
  const row2 = document.getElementById("row2");

  container.addEventListener("click", function (event) {
    // Check if a button was clicked
    if (event.target.tagName === "BUTTON") {
      const clickedButton = event.target;
      // Get the background image URL
      const backgroundImageUrl = clickedButton.style.backgroundImage
        .replace('url("', "")
        .replace('")', "");

      // Extract just the filename without the ".svg" extension
      const filename = backgroundImageUrl.split("/").pop();
      // Call a function with the extracted filename

      console.log(filename, tempAnswers[pos], pos, tempAnswers);
      console.log(
        "Calling recordAnswer with filename in Test.js createOptions:",
        filename,
      );
      recordAnswer(filename);

      init_newTrial();
    }
  });

  // Populate rows with buttons and images
  for (let i = 0; i < answers.length; i++) {
    const button = document.createElement("button");
    const imageUrl = `${testConfig.dir}/${answers[i]}`;
    button.style.width = "75px";
    button.style.height = "75px";
    button.style.margin = "5px";
    button.style.backgroundImage = `url(${imageUrl})`;
    button.style.backgroundSize = "contain";
    button.style.backgroundPosition = "center center";
    button.style.border = "none"; // Remove button border

    if (i < 10) {
      row1.appendChild(button);
    } else {
      row2.appendChild(button);
    }
  }
}

export function shuffleStimulus() {
  // Check if testConfig has stimulus, if not, wait and retry
  if (testConfig && testConfig.stimulus && testConfig.stimulus.length > 0) {
    // Shuffle the images array
    let shuffled = testConfig.stimulus.sort(() => Math.random() - 0.5);

    // Reverse the shuffled array
    shuffledStim = shuffled.reverse();

    // Check if the type is "Practice" and reverse the practice stimuli instead
    if (
      type === "Practice" &&
      testConfig.practiceStim &&
      testConfig.practiceStim.length > 0
    ) {
      shuffledStim = testConfig.practiceStim.reverse();
    }
  } else {
    // Retry after a short delay if the stimulus is not ready
    setTimeout(shuffleStimulus, 100); // Retry after 100ms
  }
}

export function get_nextCondition() {
  return shuffledStim.pop(); // Pop the last element from shuffleStimulus
}

export function shuffle(array) {
  let arrCopy = array.slice(); // This creates a new copy of the array
  for (let i = arrCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrCopy[i], arrCopy[j]] = [arrCopy[j], arrCopy[i]]; // Swap elements
  }
  return arrCopy;
}

export async function nextArrow() {
  PeripheralStim.style.opacity = "0.0";
  BorderStim.style.opacity = "1.0";
  container_options.style.opacity = "1";
  await stopRecording();
  //aryaman recordAnswer, make some other div visible to tell them, start next trial
  const dir = condition.direction == 1 ? "L" : "R";
  const timestamp = new Date().getTime();
  _videoURL =
    "Phonics_" +
    tempAnswers +
    "_" +
    timestamp +
    "_" +
    store.session.get("id") +
    ".webm";

  const uploadUrl = await saveRecordings({
    filename: _videoURL,
    config: _config,
  }); // Save the recorded audio and
  recordAnswer(_videoURL, uploadUrl);
  init_newTrial();
}

export async function responseBar() {
  // fixationStim.style.visibility = "hidden";
  // PeripheralStim.style.visibility = "hidden";
  PeripheralStim.style.opacity = "0.0";
  BorderStim.style.opacity = "1.0";

  // if (eyeMoved & (count_eyeMoved < 15)) {
  //   // your eye moved
  //   showPopUp(
  //     "Uh Oh, your eyes moved! Keep them on the cross at all times when the cross is present.",
  //     false,
  //     "fixationBreak",
  //   );
  // } else {
  container_options.style.opacity = "1";
  // init_newTrial()

  await stopRecording();
  //aryaman recordAnswer, make some other div visible to tell them, start next trial
  const dir = condition.direction == 1 ? "L" : "R";
  const timestamp = new Date().getTime();
  _videoURL =
    "Phonics_" +
    tempAnswers[0].replace(".svg", "") +
    "_" +
    pos +
    "_" +
    timestamp +
    "_" +
    store.session.get("id") +
    ".webm";
  const uploadUrl = await saveRecordings({
    filename: _videoURL,
    config: _config,
  }); // Save the recorded audio and
  if (eyeMoved) {
    setTimeout(function () {
      recordAnswer("", eyeMoved, uploadUrl);
      init_newTrial();
    }, 5000); // Delay in milliseconds (1000 ms = 1 second)
  }
}

export function initLayout() {
  var centerPos = deviceConfig.screenWidthPX / 2;
  var leftPos = deviceConfig.screenWidthPX / 2 - eccentricity * PixelsPerDegree;
  var rightPos =
    deviceConfig.screenWidthPX / 2 + eccentricity * PixelsPerDegree;
  fixationStim.style.height = "4vh";
  fixationStim.style.width = "auto";
  PeripheralStim.style.left = centerPos.toString() + "px";
}

export function setConfig(config) {
  _config = config;
}
