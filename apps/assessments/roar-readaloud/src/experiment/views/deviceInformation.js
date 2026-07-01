export function getDeviceInfo() {
  const navigatorInfo = window.navigator;
  const screenInfo = window.screen;

  // Basic device information from the navigator object
  const deviceDetails = {
    userAgent: navigatorInfo.userAgent,
    platform: navigatorInfo.platform,
    language: navigatorInfo.language,
    deviceMemory: navigatorInfo.deviceMemory || "Not available", // Requires secure context (HTTPS)
    hardwareConcurrency: navigatorInfo.hardwareConcurrency,
    maxTouchPoints: navigatorInfo.maxTouchPoints,
    cookiesEnabled: navigatorInfo.cookieEnabled,
    webDriver: navigatorInfo.webdriver,
    onlineStatus: navigatorInfo.onLine,
    gpu: "Not available",
  };

  // Screen information
  const screenSize = {
    width: screenInfo.width,
    height: screenInfo.height,
    colorDepth: screenInfo.colorDepth,
    pixelDepth: screenInfo.pixelDepth,
    retinaDisplay: window.matchMedia("(-webkit-min-device-pixel-ratio: 2)")
      .matches,
    landscapeOrientation: window.matchMedia("(orientation: landscape)").matches,
  };

  // GPU information using WebGL (limited details due to security)
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (gl) {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    deviceDetails.gpu = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "Not available";
  }

  // Combine all gathered information into a single object
  const deviceInfo = {
    device: deviceDetails,
    screen: screenSize,
  };

  return deviceInfo;
}
