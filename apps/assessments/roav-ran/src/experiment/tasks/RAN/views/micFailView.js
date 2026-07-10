/**
 * @fileoverview module to support micFailView
 * @module micFailView
 */

import mic_fail_page from './micFail.html';
import { loadScriptsFromElement, executeInlineScripts, cleanupDynamicScripts } from '../../shared/views/viewUtils.js';

/**
 * Displays an ending slide informing the user the app is closing due to mic failure.
 * @async
 * @function micFailView
 * @param {Object} slide - Slide data with header.text and footer.text (and optional audioSrc fields).
 * @param {Object} config - Configuration object.
 * @returns {Promise<void>} A promise that resolves when the user clicks the continue button.
 */
export async function micFailView(slide, config) {
  const micFailPage = document.createElement('div');
  micFailPage.innerHTML = mic_fail_page;

  document.body.appendChild(micFailPage);

  window.micFailSlide = slide;
  window.micFailAbortController = new AbortController();

  await loadScriptsFromElement(micFailPage);
  executeInlineScripts(micFailPage);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        micFailPage.remove();
        cleanup();
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Cleans up event listeners and dynamically added script elements.
 * @function cleanup
 */
function cleanup() {
  if (window.micFailAbortController) {
    window.micFailAbortController.abort();
    delete window.micFailAbortController;
  }
  delete window.micFailSlide;
  cleanupDynamicScripts();
}
