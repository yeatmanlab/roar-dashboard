import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { state } from './et_state';
import { ET_SESSION_KEYS as SK } from './et_sessionKeys';
import { AssessmentStage } from '../shared/helpers/namingHelpers';
import { sessionGet } from '../shared/helpers/sessionHelpers';
import { jsPsych } from '../shared/helpers/taskSetup';

export function collectDataDeviceScreenWebcam() {
  const { navigator, screen } = window;
  const strUnknown = 'unknown';

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
  // --- infoDevice.gpu
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    infoDevice.gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : strUnknown;
  }

  // === infoScreen
  const infoScreen = {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    retinaDisplay: window.matchMedia('(-webkit-min-device-pixel-ratio: 2)').matches,
    landscapeOrientation: window.matchMedia('(orientation: landscape)').matches,
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
  const tagTrial = 'et-collect-data-device-screen-webcam';
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

// ==================================================================

// widthScreenPx — window.innerWidth after fullscreen
// heightScreenPx — window.innerHeight after fullscreen
// widthScreenCm — physical screen width in cm (credit card)
// heightScreenCm — physical screen height in cm (credit card)
// heightCamera — user-entered cm offset of webcam from screen center
// flNorm — from device JSON, or 0
// startTime — Date.now()
// trackEyes — from variant params
// storeVideo — from variant params
// storeAudio — from variant params
// timed — from variant params
// infoDevice
//    device
//      userAgent
//      platform
//      language
//      deviceMemory
//      hardwareConcurrency
//      maxTouchPoints
//      cookiesEnabled
//      webDriver
//      onlineStatus
//      gpu
//    screen
//      width
//      height
//      colorDepth
//      pixelDepth
//      retinaDisplay
//      landscapeOrientation
// infoWebcam — from videoTrack.getCapabilities() (all capability fields, varies by browser/device) plus:
// infoWebcam.image_width — actual video stream width in pixels
// infoWebcam.image_height — actual video stream height in pixels

// ===================================================================

// /**
//  * Retrieves device and screen information from the browser.
//  *
//  * @export
//  * @function
//  * @returns {Object} An object containing detailed device and screen information.
//  *
//  * @property {Object} device - Basic device information retrieved from the `navigator` object.
//  * @property {string} device.userAgent - The user agent string of the browser.
//  * @property {string} device.platform - The platform on which the browser is running.
//  * @property {string} device.language - The preferred language of the user.
//  * @property {string|number} device.deviceMemory - The amount of device memory (in GB), or "Not available" if unsupported.
//  * @property {number} device.hardwareConcurrency - The number of logical processor cores.
//  * @property {number} device.maxTouchPoints - The maximum number of touch points supported.
//  * @property {boolean} device.cookiesEnabled - Indicates whether cookies are enabled.
//  * @property {boolean} device.webDriver - Indicates whether the browser is controlled by WebDriver automation.
//  * @property {boolean} device.onlineStatus - Indicates whether the browser is currently online.
//  * @property {string} device.gpu - The detected GPU renderer or "Not available" if unavailable.
//  *
//  * @property {Object} screen - Screen and display-related information.
//  * @property {number} screen.width - The screen width in pixels.
//  * @property {number} screen.height - The screen height in pixels.
//  * @property {number} screen.colorDepth - The number of bits used to represent colors.
//  * @property {number} screen.pixelDepth - The number of bits per pixel.
//  * @property {boolean} screen.retinaDisplay - Indicates if the screen is a Retina display (device pixel ratio ≥ 2).
//  * @property {boolean} screen.landscapeOrientation - Indicates if the screen is in landscape orientation.
//  */
