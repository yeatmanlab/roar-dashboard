import store from "store2";
import headCalibration_page from "./headCalibration.html";
import loadingScreen_page from "./loadingScreen.html";
import eyetrackingVars from "./eyetrackingVars.html";
import * as headeyetrackingJS from "./headeyetracking.js";
import * as videoCaptureJS from "./videoCapture.js";

window.store = store;

export async function headCalibrationView(config) {
  var myWorker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });

  window.myWorker = myWorker;

  const viewingDistance = config.firekit.task.variantParams.viewingDistance;
  const html = headCalibration_page;
  const loadingHtml = loadingScreen_page;

  const eyetrackingVars_page = document.createElement("div");
  eyetrackingVars_page.innerHTML = eyetrackingVars;

  // Create a div and set its innerHTML to the loaded HTML content
  const page = document.createElement("div");
  page.style.position = "fixed";
  page.style.top = "0";
  page.style.left = "0";
  page.style.width = "100%";
  page.style.height = "100%";

  await loadExternalScripts(videoCaptureJS);
  await loadExternalScripts(headeyetrackingJS);
  page.innerHTML = html;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Load and execute external scripts
  await loadHeadingScripts(page);
  await loadHeadingScripts(eyetrackingVars_page);
  executeInlineScripts(eyetrackingVars_page);
  executeInlineScripts(page);
  DOMloaded(viewingDistance);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    document.addEventListener(
      "pageComplete",
      async () => {
        setParticipantConfig();
        updateDeviceConfigIfNeeded(viewingDistance);
        page.innerHTML = loadingHtml;
        resetStyles(page);
        const uploadUrl = await upload(viewingDistance, config);

        const results = {
          assessment_type: "Phonics",
          assessment_stage: "headCalibration",
          videoURL: _videoURL,
          distance: viewingDistance,
          parentDir: store.session.get("id"),
          deviceConfig: store.session.get("deviceConfig"),
          participantConfig: store.session.get("participantConfig"),
          correct: 1,
          uploadUrl: uploadUrl,
        };

        config.firekit.writeTrial(results);

        unloadExternalScripts(videoCaptureJS);
        unloadExternalScripts(headeyetrackingJS);
        page.remove();
        cleanup();
        resolve();
      },
      { once: true },
    );
  });
}

function resetStyles(element) {
  element.style.position = ""; // Reset to static, which is the default for most elements
  element.style.top = "";
  element.style.left = "";
  element.style.width = ""; // Resets to auto
  element.style.height = ""; // Resets to auto
}

async function upload(viewingDistance, config) {
  const timestamp = new Date().getTime();
  await stopRecording(); // Stop recording when stimulus is clicked

  var filename =
    "Phonics_headCalibration" +
    "_" +
    viewingDistance.toString() +
    "_" +
    timestamp +
    "_" +
    store.session.get("id") +
    ".webm";
  _videoURL = filename;

  try {
    return await saveRecordings({
      filename,
      config,
    });
  } catch (error) {
    console.error("Error in saveRecordings:", error);
  }
}

function setParticipantConfig() {
  store.session.set("participantConfig", {
    widthLeftIris: medianOfMetrics(irisMetrics_array, "widthLeftIris"),
    widthRightIris: medianOfMetrics(irisMetrics_array, "widthRightIris"),
    headWidth: medianOfMetrics(headMetrics_array, "headWidth"),
    headHeight: medianOfMetrics(headMetrics_array, "headHeight"),
    headCenterX: medianOfMetrics(headMetrics_array, "headCenterX"),
    headCenterY: medianOfMetrics(headMetrics_array, "headCenterY"),
    canvasContour: canvasContour,
  });
}

function updateDeviceConfigIfNeeded(estimatedDistance) {
  const deviceConfig = store.session.get("deviceConfig") || {};
  if (deviceConfig.normalizedFocalLength == 0) {
    const dX = 11.7;
    const leftdZ = estimatedDistance;
    const rightdZ = estimatedDistance; // assuming you have a rightdZ similar to leftdZ
    const Leftdx = 1; // assuming you have a Leftdx, define or get this value
    const Rightdx = 1; // assuming you have a Rightdx, define or get this value
    const focalLengthMultiple = 1; // define or get this value

    const fx =
      ((leftdZ * 10.0) / (dX / Leftdx) + (rightdZ * 10.0) / (dX / Rightdx)) / 2;
    const normalizedFocalLength = fx / focalLengthMultiple;

    deviceConfig.normalizedFocalLength = normalizedFocalLength;
    store.session.set("deviceConfig", deviceConfig);
  }
}

async function DOMloaded(viewingDistance) {
  var description = document.getElementById("instructionDescription");
  const deviceConfig = store.session.get("deviceConfig") || {};
  if (deviceConfig.normalizedFocalLength == 0) {
    description.innerHTML = `
    <h5>Measure the distance from your webcam to yourself. Move back until you are exactly ${viewingDistance}cm away. Then, <b>hold down</b> the 'Continue' button.</h5>
    `;
  } else {
    description.innerHTML = `
    <h5>Move back until you are exactly ${viewingDistance}cm away. Then, <b>hold down</b> the 'Continue' button.</h5>
    `;
  }

  continueProcessing = true;
  await giveAccess();
  initEyeTracking();
  setTimeout(() => {
    runInference();
  }, 2000);
}

function cleanup() {
  const dynamicScripts = document.querySelectorAll("script[data-dynamic]");
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
}

function unloadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    const propDesc = Object.getOwnPropertyDescriptor(window, key);
    if (propDesc && propDesc.configurable) {
      delete window[key];
    } else {
      console.log(
        `Cannot remove ${key} from window; it may be non-configurable.`,
      );
    }
  });
}

async function loadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    window[key] = src[key];
  });
}

async function loadHeadingScripts(element) {
  // Extract and load external scripts within the specified element
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.src) {
      await loadScript(script.src);
    }
  }
}

function executeInlineScripts(element) {
  // Extract and execute inline scripts within the specified element
  const scripts = element.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    const script = document.createElement("script");
    script.text = scripts[i].text;
    document.head.appendChild(script).parentNode.removeChild(script);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
