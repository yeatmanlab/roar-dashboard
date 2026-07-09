import store from "store2";
import configureDevice_page from "./configureDevice.html";
import loadingScreen_page from "./loadingScreen.html";
import * as initJS from "./configureDevice.js";
import { getDeviceInfo } from "./deviceInformation.js";
import i18next from "i18next";
import { openFullscreen } from "./videoCapture.js";
import { checkBoolean } from "../helpers/helperFunctions.js";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  assignModuleToWindow,
  removeModuleFromWindow,
  cleanupDynamicScripts,
  setLanguage,
} from "./viewUtils.js";
import { unlockAudio } from "../helpers/audioUnlock.js";

export async function configureDeviceView(config) {
  // Object.keys(window.translations.store.data.en.translation)
  // Object.keys(i18next.store.data.en.translation)

  const configureDeviceHtml = configureDevice_page;
  const loadingHtml = loadingScreen_page;
  // Create a div and set its innerHTML to the loaded HTML content
  const page = document.createElement("div");
  page.innerHTML = configureDeviceHtml;

  // Hide during initialization to prevent flash of incorrectly-configured cards
  page.style.visibility = "hidden";

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(page);

  // Load and execute external scripts
  await loadScriptsFromElement(page);
  assignModuleToWindow(initJS);
  executeInlineScripts(page);
  DOMloaded(config);

  // Reveal after all card visibility and numbering are finalized
  page.style.visibility = "";

  setLanguage(i18next.store.data[i18next.language].translation);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    const confirmButton = document.getElementById("confirmButton");
    if (confirmButton) {
      confirmButton.addEventListener("click", async () => {
        unlockAudio();
        try {
          var id =
            // store.session.get("config").firekit.user.assessmentUid +
            // "_" +
            idInput_textbox.value.trim() ? idInput_textbox.value : makeid(10);

          if (id !== config.firekit.user.assessmentPid) {
            config.firekit.updateUser({ assessmentPid: id });
          }

          openFullscreen();

          store.session.set("id", id);
          store.session.set("deviceConfig", {
            screenWidth: parseFloat(screenWidth),
            screenHeight: parseFloat(screenHeight),
            screenWidthPX: parseFloat(screenWidthPX),
            screenHeightPX: parseFloat(screenHeightPX),
            webcamHeight: parseFloat(webcamHeight),
            normalizedFocalLength: parseFloat(normalizedFocalLength),
            deviceInfo: getDeviceInfo(),
            webcamInfo: webcamInfo,
            bEyeTracking: checkBoolean(
              config.firekit.task.variantParams.bEyeTracking,
            ),
            storeVideo: checkBoolean(
              config.firekit.task.variantParams.storeVideo,
            ),
            startTime: Date.now(),
            timed: config.firekit.task.variantParams.timed,
          });

          page.innerHTML = loadingHtml;

          cleanup(initJS); // Cleanup added scripts
          page.remove(); // Remove the page
          resolve();
        } catch (error) {
          window.console.log("Error:", error);
        }
      });
    }
  });
}

function DOMloaded(config) {
  if (config.firekit.task.variantParams.deviceConfigFile !== "") {
    collapseCards("Toggle");
  }

  const bEyeTracking = checkBoolean(
    config.firekit.task.variantParams.bEyeTracking,
  );

  // Set the global bEyeTracking variable for the inline script
  window.bEyeTracking = bEyeTracking;

  if (!bEyeTracking) {
    // Audio-only mode: hide all camera-related cards
    collapseCamera();
    // Show audio-only card and hide camera card
    const audioCameraCards = document.getElementById(
      "access-cameracollapsableCards",
    );
    const audioOnlyCards = document.getElementById(
      "access-audiocollapsableCards",
    );
    const checkAudioCards = document.getElementById(
      "check-audiocollapsableCards",
    );
    if (audioCameraCards) {
      audioCameraCards.style.display = "none";
    }
    if (audioOnlyCards) {
      audioOnlyCards.style.display = "block";
    }
    if (checkAudioCards) {
      checkAudioCards.style.display = "block";
    }
  } else {
    // Eye tracking mode: hide webcam config cards but show camera access card
    collapseCamera();
    // Show camera card and hide audio-only card
    const audioCameraCards = document.getElementById(
      "access-cameracollapsableCards",
    );
    const audioOnlyCards = document.getElementById(
      "access-audiocollapsableCards",
    );
    const checkCameraCards = document.getElementById(
      "check-cameracollapsableCards",
    );
    const checkAudioCards = document.getElementById(
      "check-audiocollapsableCards",
    );
    if (audioCameraCards) {
      audioCameraCards.style.display = "block"; // Must show for eye tracking
    }
    if (checkCameraCards) {
      checkCameraCards.style.display = "block"; // Must show for final checks
    }
    if (audioOnlyCards) {
      audioOnlyCards.style.display = "none";
    }
    if (checkAudioCards) {
      checkAudioCards.style.display = "none";
    }
  }

  if (config.firekit.user.assessmentPid !== "") {
    inputParticipantName(config.firekit.user.assessmentPid);
  }

  var voiceover = document.getElementById("voiceover"); // TO DO: Doesn't have enough time to load? Only plays if the consent screen shows up first
  const _configureDeviceAudioUrl =
    "https://storage.googleapis.com/roav-ran/en/shared/audio/configureDeviceViewAudio.mp3";
  voiceover.src =
    window._preloadedAudioURLs?.get(_configureDeviceAudioUrl) ??
    _configureDeviceAudioUrl;

  if (config.firekit.task.variantParams.deviceConfigFile !== "") {
    var jsonUrl = `https://eyetrackingdata.blob.core.windows.net/public/config/${config.firekit.task.variantParams.deviceConfigFile}.json`;
    updateDeviceConfigFromJSON(jsonUrl);
  }

  initJS.updateCardNumbers();

  voiceover.play();
}

function cleanup(src) {
  removeModuleFromWindow(src);
  cleanupDynamicScripts();
}
