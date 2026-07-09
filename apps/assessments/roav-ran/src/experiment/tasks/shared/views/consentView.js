/**
 * @fileoverview module to support consentView.js
 * @module consentView
 */

import consent_page from "./consent.html";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  cleanupDynamicScripts,
} from "./viewUtils.js";
import { unlockAudio } from "../helpers/audioUnlock.js";

/**
 * Displays the consent view by injecting the consent page into the DOM.
 * Waits for the user to click the "Start Experiment" button before resolving.
 *
 * @returns {Promise<void>} A promise that resolves when the user confirms consent.
 */
export async function consentView() {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/consent.html");
  const consentHtml = consent_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const consentPage = document.createElement("div");
  consentPage.innerHTML = consentHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(consentPage);

  // Load and execute external scripts
  await loadScriptsFromElement(consentPage);
  executeInlineScripts(consentPage);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    const confirmButton = document.getElementById("confirmButton");
    if (confirmButton) {
      confirmButton.addEventListener("click", () => {
        unlockAudio();
        cleanupDynamicScripts(); // Cleanup added scripts
        consentPage.remove(); // Remove the confirmation page
        resolve();
      });
    }
  });
}
