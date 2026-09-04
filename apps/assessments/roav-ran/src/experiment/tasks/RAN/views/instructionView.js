/**
 * @fileoverview module to support instructionView
 * @module instructionView
 */

import instruction_page from './instruction.html';
import { loadScriptsFromElement, executeInlineScripts, cleanupDynamicScripts } from '../../shared/views/viewUtils.js';

/**
 * Displays an instruction/practice feedback view and handles user interaction.
 * @async
 * @function instructionView
 * @param {Object} stage - The current stage of the instruction (e.g. "LetterIntro").
 * @param {Object} config - Configuration object.
 * @returns {Promise<void>} A promise that resolves when the view is completed.
 */
export async function instructionView(stage, config) {
  const instructionHtml = instruction_page;

  const instructionPage = document.createElement('div');
  instructionPage.innerHTML = instructionHtml;

  document.body.appendChild(instructionPage);

  window.instructionStage = stage;

  window.instructionAbortController = new AbortController();

  await loadScriptsFromElement(instructionPage);
  executeInlineScripts(instructionPage);

  return new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        instructionPage.remove();
        cleanup();
        resolve({ micFailed: false });
      },
      { once: true },
    );

    document.addEventListener(
      'instructionMicFailed',
      () => {
        instructionPage.remove();
        cleanup();
        resolve({ micFailed: true });
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
  if (window.instructionAbortController) {
    window.instructionAbortController.abort();
    delete window.instructionAbortController;
  }
  cleanupDynamicScripts();
}
