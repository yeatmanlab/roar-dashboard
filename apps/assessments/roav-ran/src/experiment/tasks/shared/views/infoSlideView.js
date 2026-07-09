/**
 * @fileoverview module to support infoSlideView
 * @module infoSlideView
 */

import info_slide_page from "./infoSlide.html";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  cleanupDynamicScripts,
} from "./viewUtils.js";
import { isPortrait, isMobile } from "../helpers/detectDevice.js";

/**
 * Displays a sequence of informational/transition slides with a lion mascot.
 * Each slide shows a heading, body text, and an optional continue button.
 * @async
 * @function infoSlideView
 * @param {Object|Array<Object>} slides - A single slide object or array of slide objects.
 *   Each slide: { header: { text: string, audioSrc?: string }, footer?: { text: string, audioSrc?: string }, showButton?: boolean }
 * @param {Object} config - Configuration object.
 * @returns {Promise<void>} A promise that resolves when all slides are complete.
 */
export async function infoSlideView(slides, config) {
  if (!Array.isArray(slides)) slides = [slides];
  const infoSlideHtml = info_slide_page;

  const infoSlidePage = document.createElement("div");
  infoSlidePage.innerHTML = infoSlideHtml;

  document.body.appendChild(infoSlidePage);

  window.isMobile = isMobile();
  window.isPortrait = isPortrait();

  window.infoSlides = slides;
  window.infoSlideAbortController = new AbortController();

  await loadScriptsFromElement(infoSlidePage);
  executeInlineScripts(infoSlidePage);

  await new Promise((resolve) => {
    document.addEventListener(
      "pageComplete",
      () => {
        infoSlidePage.remove();
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
  if (window.infoSlideAbortController) {
    window.infoSlideAbortController.abort();
    delete window.infoSlideAbortController;
  }
  delete window.infoSlides;
  delete window.isMobile;
  delete window.isPortrait;
  cleanupDynamicScripts();
}
