import store from "store2";
import calibration_page from "./calibration.html";
import calibration_page_short from "./calibration_short.html";
import loadingScreen_page from "./loadingScreen.html";
import eyetrackingVars from "./eyetrackingVars.html";
import * as headeyetrackingJS from "./headeyetracking.js";
import * as videoCaptureJS from "./videoCapture.js";
import { PolynomialRegression } from "ml-regression-polynomial";
import i18next from "i18next";
import { checkBoolean } from "../helpers/helperFunctions.js";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  assignModuleToWindow,
  removeModuleFromWindow,
  cleanupDynamicScripts,
  resetStyles,
  setLanguage,
} from "./viewUtils.js";

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

  assignModuleToWindow(videoCaptureJS);
  assignModuleToWindow(headeyetrackingJS);
  page.innerHTML = html;
  const loadingHtml = loadingScreen_page;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Load and execute external scripts
  await loadScriptsFromElement(page);
  await loadScriptsFromElement(eyetrackingVars_page);
  executeInlineScripts(eyetrackingVars_page);
  executeInlineScripts(page);

  // load scripts inside DOMloaded
  DOMloaded(config);
  setLanguage(i18next.store.data[i18next.language].translation);

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

        let regressors = null;
        let calibrationSuccessful = false;

        // Check if we have sufficient calibration data
        if (
          _eyeCoordinates_cal.length >= 2 &&
          _gridCoordinates_cal.length >= 2
        ) {
          try {
            regressors = get_Regressors(
              _eyeCoordinates_cal,
              _gridCoordinates_cal,
            ); // Get regression coefficients
            storeRegressorsInSession(regressors);
            calibrationSuccessful = true;
          } catch (error) {
            console.warn(
              "Calibration failed due to insufficient or invalid data:",
              error,
            );
            console.warn("Proceeding without eye tracking calibration.");
          }
        } else {
          console.warn(
            "Insufficient calibration data collected. Face detection may have failed.",
          );
          console.warn("Proceeding without eye tracking calibration.");
        }
        await endCalibration(config, regressors, 50);
        videoCaptureJS.stopMediaStreams();
        // Wait for the iOS AVAudioSession interrupted→running statechange cycle to
        // complete before resolving. If we resolve immediately after stopping tracks,
        // the next view's play() is called mid-transition and produces no sound.
        await new Promise((r) => setTimeout(r, 100));

        removeModuleFromWindow(videoCaptureJS);
        removeModuleFromWindow(headeyetrackingJS);
        page.remove(); // Remove the confirmation page
        cleanupDynamicScripts();
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

async function endCalibration(config, regressors, estimatedDistance) {
  console.log("Test Finished");
  const timestamp = new Date().getTime();
  await stopRecording(); // Stop recording when stimulus is clicked

  var filename =
    "RAN_eyeCalibration" +
    "_" +
    estimatedDistance.toString() +
    "_" +
    timestamp +
    ".webm";

  try {
    let objectURL = null;
    const storeVideo = checkBoolean(window.deviceConfig.storeVideo);
    if (storeVideo) {
      objectURL = await saveRecordings({
        filename,
        deviceConfig: window.deviceConfig,
        config,
        metadata: {},
      });
      // console.log('Saving Recording to:', objectURL);
    }

    const results = {
      assessment_type: "MEP",
      assessment_stage: "eyeCalibration",
      recordedVideo: filename,
      distance: estimatedDistance,
      regressors: regressors,
      stimulusPosition: _gridCoordinates,
      eyeCoordinates: _eyeCoordinates,
      calibrationData: _calibrationData,
      uploadURL: objectURL,
      _timeData: _timeData,
      parentDir: store.session.get("id"),
      deviceConfig: store.session.get("deviceConfig"),
      participantConfig: store.session.get("participantConfig"),
      correct: 1,
    };

    config.firekit.writeTrial(results);
  } catch (error) {
    console.error("Error in saveRecordings:", error);
  }
}

async function DOMloaded(config) {
  initEyeTracking(false);
  try {
    const deviceConfig = store.session.get("deviceConfig");
    const bEyeTracking = deviceConfig.bEyeTracking;
    const storeVideo = deviceConfig.storeVideo;
    await giveAccess(bEyeTracking, storeVideo);
  } catch (error) {
    console.error("Camera access failed:", error);
  }
  startTest();
}
