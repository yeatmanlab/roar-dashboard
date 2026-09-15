export function isMobile() {
  if (typeof window === 'undefined') {
    return false;
  }
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const isTablet =
    /iPad|iPod/i.test(navigator.userAgent) ||
    navigator.platform === 'iPad' ||
    navigator.userAgentData?.platform === 'iPad' ||
    ((navigator.userAgent.match(/Mac/) || navigator.platform === 'MacIntel') &&
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 0);

  return isMobile || isTablet;
}

// Currently always used with isMobile so this won't affect small browsers on non-mobile devices
export function isPortrait() {
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  return height > width;
}
