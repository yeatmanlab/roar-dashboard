/**
 * @fileoverview module to support collecting device information
 * @module deviceInformation
 */

/**
 * Retrieves device and screen information from the browser.
 *
 * @export
 * @function
 * @returns {Object} An object containing detailed device and screen information.
 *
 * @property {Object} device - Basic device information retrieved from the `navigator` object.
 * @property {string} device.userAgent - The user agent string of the browser.
 * @property {string} device.platform - The platform on which the browser is running.
 * @property {string} device.language - The preferred language of the user.
 * @property {string|number} device.deviceMemory - The amount of device memory (in GB), or "Not available" if unsupported.
 * @property {number} device.hardwareConcurrency - The number of logical processor cores.
 * @property {number} device.maxTouchPoints - The maximum number of touch points supported.
 * @property {boolean} device.cookiesEnabled - Indicates whether cookies are enabled.
 * @property {boolean} device.webDriver - Indicates whether the browser is controlled by WebDriver automation.
 * @property {boolean} device.onlineStatus - Indicates whether the browser is currently online.
 * @property {string} device.gpu - The detected GPU renderer or "Not available" if unavailable.
 *
 * @property {Object} screen - Screen and display-related information.
 * @property {number} screen.width - The screen width in pixels.
 * @property {number} screen.height - The screen height in pixels.
 * @property {number} screen.colorDepth - The number of bits used to represent colors.
 * @property {number} screen.pixelDepth - The number of bits per pixel.
 * @property {boolean} screen.retinaDisplay - Indicates if the screen is a Retina display (device pixel ratio ≥ 2).
 * @property {boolean} screen.landscapeOrientation - Indicates if the screen is in landscape orientation.
 */
export function getDeviceInfo() {
  const navigatorInfo = window.navigator;
  const screenInfo = window.screen;

  // Basic device information from the navigator object
  const deviceDetails = {
    userAgent: navigatorInfo.userAgent,
    platform: navigatorInfo.platform,
    language: navigatorInfo.language,
    deviceMemory: navigatorInfo.deviceMemory || 'Not available', // Requires secure context (HTTPS)
    hardwareConcurrency: navigatorInfo.hardwareConcurrency,
    maxTouchPoints: navigatorInfo.maxTouchPoints,
    cookiesEnabled: navigatorInfo.cookieEnabled,
    webDriver: navigatorInfo.webdriver,
    onlineStatus: navigatorInfo.onLine,
    gpu: 'Not available',
  };

  // Screen information
  const screenSize = {
    width: screenInfo.width,
    height: screenInfo.height,
    colorDepth: screenInfo.colorDepth,
    pixelDepth: screenInfo.pixelDepth,
    retinaDisplay: window.matchMedia('(-webkit-min-device-pixel-ratio: 2)').matches,
    landscapeOrientation: window.matchMedia('(orientation: landscape)').matches,
  };

  // GPU information using WebGL (limited details due to security)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    deviceDetails.gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Not available';
  }

  // Combine all gathered information into a single object
  const deviceInfo = {
    device: deviceDetails,
    screen: screenSize,
  };

  return deviceInfo;
}
