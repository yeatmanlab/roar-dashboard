import store from "store2";
import calibration_page from "./calibration.html";
import calibration_page_short from "./calibration_short.html";
import loadingScreen_page from "./loadingScreen.html";
import eyetrackingVars from "./eyetrackingVars.html";
import * as headeyetrackingJS from "./headeyetracking.js";
import * as videoCaptureJS from "./videoCapture.js";
import { PolynomialRegression } from "ml-regression-polynomial";

window.store = store;

export async function calibrationView(config) {
  var myWorker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });

  window.myWorker = myWorker;
  var html = calibration_page;
  if (config.firekit.task.variantParams.calibrationType === "short") {
    html = calibration_page_short;
  }
  const eyetrackingVars_page = document.createElement("div");
  eyetrackingVars_page.innerHTML = eyetrackingVars;

  const page = document.createElement("div");
  page.style.position = "fixed";
  page.style.top = "0";
  page.style.left = "0";
  page.style.width = "100%";
  page.style.height = "100%";

  await loadExternalScripts(videoCaptureJS);
  await loadExternalScripts(headeyetrackingJS);
  page.innerHTML = html;
  const loadingHtml = loadingScreen_page;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Load and execute external scripts
  await loadHeadingScripts(page);
  await loadHeadingScripts(eyetrackingVars_page);
  executeInlineScripts(eyetrackingVars_page);
  executeInlineScripts(page);

  // load scripts inside DOMloaded
  DOMloaded(config);
  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    document.addEventListener(
      "pageComplete",
      async () => {
        page.innerHTML = loadingHtml;
        resetStyles(page);
        var _eyeCoordinates_cal = _eyeCoordinates.filter(
          (_, index) => _calibrationData[index] == 1,
        );
        var _gridCoordinates_cal = _gridCoordinates.filter(
          (_, index) => _calibrationData[index] == 1,
        );
        const regressors = get_Regressors(
          _eyeCoordinates_cal,
          _gridCoordinates_cal,
        ); // Get regression coefficients
        storeRegressorsInSession(regressors);

        const uploadUrl = await upload(50, config);

        const results = {
          assessment_type: "Crowding",
          assessment_stage: "eyeCalibration",
          recordedVideo: _videoURL,
          distance: 50,
          regressors: regressors,
          stimulusPosition: _gridCoordinates,
          eyeCoordinates: _eyeCoordinates,
          calibrationData: _calibrationData,
          _timeData: _timeData,
          parentDir: store.session.get("id"),
          deviceConfig: store.session.get("deviceConfig"),
          participantConfig: store.session.get("participantConfig"),
          correct: 1,
          uploadUrl: uploadUrl,
        };

        config.firekit.writeTrial(results);

        unloadExternalScripts(videoCaptureJS);
        unloadExternalScripts(headeyetrackingJS);
        page.remove(); // Remove the confirmation page
        cleanup();
        resolve();
      },
      { once: true },
    );
  });
}

function get_Regressors(eyeCoordinates, gridCoordinates) {
  const regression_x = new PolynomialRegression(
    eyeCoordinates.map((eyeCoordinate) => eyeCoordinate.x),
    gridCoordinates.map((gridCoordinate) => gridCoordinate.x),
    1,
  );
  const regression_y = new PolynomialRegression(
    eyeCoordinates.map((eyeCoordinate) => eyeCoordinate.y),
    gridCoordinates.map((gridCoordinate) => gridCoordinate.y),
    1,
  );
  return {
    x_regressor: regression_x.coefficients,
    y_regressor: regression_y.coefficients,
  };
}

function storeRegressorsInSession(regressors) {
  store.session.set("x_coef", regressors.x_regressor[1]);
  store.session.set("x_intercept", regressors.x_regressor[0]);
  store.session.set("y_coef", regressors.y_regressor[1]);
  store.session.set("y_intercept", regressors.y_regressor[0]);
}

function resetStyles(element) {
  element.style.position = ""; // Reset to static, which is the default for most elements
  element.style.top = "";
  element.style.left = "";
  element.style.width = ""; // Resets to auto
  element.style.height = ""; // Resets to auto
}

async function upload(estimatedDistance, config) {
  console.log("Test Finished");
  const timestamp = new Date().getTime();

  var filename =
    "Crowding_eyeCalibration" +
    "_" +
    estimatedDistance.toString() +
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

async function loadExternalScripts(src) {
  Object.keys(src).forEach((key) => {
    window[key] = src[key];
  });
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

function cleanup() {
  // Remove dynamically added script elements from the head
  const dynamicScripts = document.querySelectorAll("script[data-dynamic]");
  dynamicScripts.forEach((script) => script.parentNode.removeChild(script));
}

async function DOMloaded(config) {
  // Update title
  var voiceover = document.getElementById("voiceover"); // TO DO: Doesn't have enough time to load? Only plays if the consent screen shows up first
  voiceover.src = `https://eyetrackingdata.blob.core.windows.net/public/Audios/calibration.mp3`;
  voiceover.play();

  var title = document.getElementById("calibrationTitle");
  title.innerHTML = `<b>Calibration Phase</b>`;

  // Update description
  var description = document.getElementById("calibrationDescription");
  description.innerHTML = `You will see a blue disc pop up on the screen. Follow it with your eyes <b>without</b> moving your head.`;
  // Update Image
  var img = document.getElementById("calibrationImage");
  img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/eyecalibration.gif`;

  if (config.firekit.task.variantParams.calibrationType === "short") {
    img.src = `https://eyetrackingdata.blob.core.windows.net/public/Images/eyecalibration_short.gif`;
  }

  initEyeTracking(false);
  await giveAccess();
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
