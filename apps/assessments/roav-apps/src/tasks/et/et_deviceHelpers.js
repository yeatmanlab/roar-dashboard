import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { state } from "./et_state";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";
import { AssessmentStage } from "../shared/helpers/namingHelpers";
import { sessionGet } from "../shared/helpers/sessionHelpers";
import { jsPsych } from "../shared/helpers/taskSetup";

export function collectDataDeviceScreenWebcam() {
  const { navigator, screen } = window;
  const strUnknown = "unknown";

  // === infoDevice
  const infoDevice = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    deviceMemory: navigator.deviceMemory || strUnknown, // Requires secure context (HTTPS)
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    cookiesEnabled: navigator.cookieEnabled,
    webDriver: navigator.webdriver,
    onlineStatus: navigator.onLine,
    gpu: strUnknown,
  };
  // === infoDevice.gpu
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (gl) {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    infoDevice.gpu = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : strUnknown;
  }

  // === infoScreen
  const infoScreen = {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    retinaDisplay: window.matchMedia("(-webkit-min-device-pixel-ratio: 2)")
      .matches,
    landscapeOrientation: window.matchMedia("(orientation: landscape)").matches,
  };

  // === infoWebcam
  const videoTrack = state.cameraStream?.getVideoTracks()[0];
  let infoWebcam = {};
  if (videoTrack) {
    const { width, height } = videoTrack.getSettings();
    infoWebcam = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
    infoWebcam.widthImg = width;
    infoWebcam.heightImg = height;
  }

  // === info combined
  const info = {
    infoDevice: infoDevice,
    infoScreen: infoScreen,
    infoWebcam: infoWebcam,
  };

  return info;
}

// IMPORTANT: should run AFTER CAMERA is ENABLED to collect camera info
export const t_et_collectDataDeviceScreenWebcam = () => {
  let info = null;
  const tagTrial = "et-collect-data-device-screen-webcam";
  return {
    type: jsPsychCallFunction,
    func: () => {
      info = collectDataDeviceScreenWebcam();
    },
    on_finish: () => {
      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        assessment_stage: AssessmentStage.DATA,
        correct: true,
        type_trial: tagTrial,
        id_trial: tagTrial,
        pid: sessionGet(SK.CONFIG).pid,
        info: info,
      });
    },
  };
};
