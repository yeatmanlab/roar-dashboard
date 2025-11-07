import { onMounted, onUnmounted } from 'vue';
import { logger } from '@/logger';

/**
 * Composable for tracking page visibility and reload events
 * Logs events when page gains/loses focus and when page is reloaded
 */
export function usePageEventTracking() {
  let isPageVisible = true;
  let beforeUnloadHandler: (() => void) | null = null;

  const handleVisibilityChange = () => {
    const currentUrl = window.location.href;
    
    if (document.hidden) {
      // Page lost focus
      isPageVisible = false;
      logger.capture('Page Event: Out of Focus', { url: currentUrl });
    } else {
      // Page gained focus
      isPageVisible = true;
      logger.capture('Page Event: In Focus', { url: currentUrl });
    }
  };

  const handleBeforeUnload = () => {
    const currentUrl = window.location.href;
    logger.capture('Page Event: Reload', { url: currentUrl });
  };

  const setupEventListeners = () => {
    // Listen for page visibility changes (focus/blur)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for page reload/close
    beforeUnloadHandler = handleBeforeUnload;
    window.addEventListener('beforeunload', beforeUnloadHandler);
  };

  const removeEventListeners = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      beforeUnloadHandler = null;
    }
  };

  onMounted(() => {
    setupEventListeners();
  });

  onUnmounted(() => {
    removeEventListeners();
  });

  return {
    isPageVisible,
    setupEventListeners,
    removeEventListeners,
  };
}
