import store from "store2";
import ran_page from "./RAN.html";
import loadingScreen_page from "../../shared/views/loadingScreen.html";
import * as initJS from "./RAN.js";
import eyetrackingVars from "../../shared/views/eyetrackingVars.html";
import * as headeyetrackingJS from "../../shared/views/headeyetracking.js";
import * as videoCaptureJS from "../../shared/views/videoCapture.js";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  assignModuleToWindow,
  removeModuleFromWindow,
  cleanupDynamicScripts,
  resetStyles,
} from "../../shared/views/viewUtils.js";
import { resumeAudioContext, whenRunning } from "../../shared/helpers/audioUnlock.js";

export async function RANView(type, config, textConfig = {}) {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/RAN.html");
  var myWorker = new Worker(new URL("../../shared/views/worker.js", import.meta.url), {
    type: "module",
  });

  window.myWorker = myWorker;
  const eyetrackingVars_page = document.createElement("div");
  eyetrackingVars_page.innerHTML = eyetrackingVars;

  let confirmationHtml = ran_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const RANPage = document.createElement("div");
  // Set the div to cover the entire page
  RANPage.style.position = "fixed";
  RANPage.style.top = "0";
  RANPage.style.left = "0";
  RANPage.style.width = "100%";
  RANPage.style.height = "100%";
  window.deviceConfig = store.session.get("deviceConfig");
  const { bEyeTracking, storeVideo } = window.deviceConfig;

  assignModuleToWindow(initJS);
  assignModuleToWindow(videoCaptureJS);
  assignModuleToWindow(headeyetrackingJS);
  RANPage.innerHTML = confirmationHtml;
  const loadingHtml = loadingScreen_page;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(RANPage);

  // initialise variables
  window.type = type;

  // Load and execute external scripts
  await loadScriptsFromElement(RANPage);
  await loadScriptsFromElement(eyetrackingVars_page);
  executeInlineScripts(eyetrackingVars_page);
  executeInlineScripts(RANPage);

  DOMloaded(type, bEyeTracking, storeVideo, textConfig);

  const abortController = new AbortController();

  await new Promise((resolve) => {
    document.body.addEventListener(
      "click",
      async function (event) {
        if (event.target.classList.contains("finish-button")) {
          resumeAudioContext();
          window.continueProcessing = false;

          RANPage.innerHTML = loadingHtml;
          resetStyles(RANPage);

          await endTrial(config, { stimulus: _shuffledImages }, type);
          videoCaptureJS.stopMediaStreams();
          // Wait for the iOS AVAudioSession interrupted→running statechange cycle to
          // complete before resolving. If we resolve immediately after stopping tracks,
          // the next view's play() is called mid-transition and produces no sound.
          await new Promise((r) => setTimeout(r, 100));

          RANPage.remove(); // Remove the confirmation page
          abortController.abort(); // Remove this body-level listener
          cleanup(initJS);
          resolve();
        }
      },
      { signal: abortController.signal },
    );
  });
}

async function endTrial(config, metadata, type) {
  console.log("Test Finished");
  await stopRecording(); // Stop recording when stimulus is clicked

  let objectURL = null;
  const timestamp = new Date().getTime();

  const filename =
    "RAN" + "_" + testConfig["testname"] + "_" + timestamp + ".webm";

  try {
    // The Cloud Function filters on customMetadata.type === 'Test' (case-sensitive).
    // Merge `type` into metadata so the Cloud Function can gate autoscoring on it.
    const uploadMetadata = { ...metadata, type };
    objectURL = await saveRecordings({
      filename,
      deviceConfig: window.deviceConfig,
      config,
      metadata: uploadMetadata,
    });
  } catch (error) {
    console.error("Error in saveRecordings:", error);
  }

  const results = {
    assessment_type: testConfig["testname"],
    assessment_stage: type,
    stimulusPosition: _gridCoordinates,
    stimulus: metadata.stimulus,
    recordedVideo: filename,
    parentDir: _parentDir,
    uploadURL: objectURL,
    xpreds: xpreds,
    ypreds: ypreds,
    eyetTimer: eyetTimer,
    correct: 1,
    deviceConfig: _deviceConfig,
    testConfig: _testConfig,
  };

  await config.firekit.writeTrial(results);
}

async function DOMloaded(type, bEyeTracking, storeVideo, textConfig) {
  initEyeTracking(false);

  await giveAccess(bEyeTracking, storeVideo);

  document.querySelector(".header").innerHTML = (
    textConfig.header.text ?? ""
  ).replace(/\n/g, "<br>");
  document.querySelector(".subtitle").innerHTML = (
    textConfig.subtitle.text ?? ""
  ).replace(/\n/g, "<br>");
  const nextText = document.querySelector(".next-text");
  nextText.textContent = textConfig.footer.text ?? "";
  nextText.style.bottom = "3rem";

  var voiceover = document.getElementById("voiceover");

  var audioQueue = [
    textConfig.header?.audioSrc,
    textConfig.subtitle?.audioSrc,
    textConfig.footer?.audioSrc,
  ].filter(Boolean);

  function playNext(queue) {
    if (queue.length === 0) return;
    var [src, ...rest] = queue;
    voiceover.src = window._preloadedAudioURLs?.get(src) ?? src;
    if (rest.length > 0) {
      voiceover.addEventListener(
        "ended",
        function () {
          playNext(rest);
        },
        { once: true },
      );
    }
    voiceover.play().catch(function (err) {
      // Same race condition as infoSlide: yield to macrotask queue so any
      // interrupted→running statechange cycle completes before retrying.
      console.warn(
        "[RANView] play() rejected:",
        err && err.name,
        "— retrying after yield",
      );
      setTimeout(function () {
        whenRunning().then(function () {
          voiceover.play().catch(function () {});
        });
      }, 0);
    });
  }

  if (audioQueue.length > 0) {
    whenRunning().then(function () {
      playNext(audioQueue);
    });
  } else {
    voiceover.src = "";
  }
}

function cleanup(src) {
  removeModuleFromWindow(src);

  // Remove event listeners from buttons by replacing them with clones
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    if (button.parentNode) {
      const clone = button.cloneNode(true);
      button.parentNode.replaceChild(clone, button);
    }
  });

  // Remove dynamically added scripts from <head>
  cleanupDynamicScripts();

  // Clear all child nodes from <body> to reset for the next view
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}
