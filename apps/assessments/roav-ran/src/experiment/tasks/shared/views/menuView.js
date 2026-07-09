/**
 * @fileoverview module to support menuView.js
 * @module menuView
 */

import menu_page from "./menu.html";
import {
  loadScriptsFromElement,
  executeInlineScripts,
  cleanupDynamicScripts,
} from "./viewUtils.js";

/**
 * Displays the menu view and handles user interaction.
 * @async
 * @function menuView
 * @param {string} tests_url - The URL for the tests.
 * @returns {Promise<void>} A promise that resolves when the user clicks the "Start Experiment" button.
 */
export async function menuView(tests_url) {
  // Load the existing HTML page
  // const response = await fetch("https://eyetrackingdata.blob.core.windows.net/public/views/menu.html");

  window.tests_url = tests_url;
  const menuHtml = menu_page;

  // Create a div and set its innerHTML to the loaded HTML content
  const menuPage = document.createElement("div");
  menuPage.innerHTML = menuHtml;

  // Append the confirmation page to the body or a specific element
  document.body.appendChild(menuPage);

  // Load and execute external scripts
  await loadScriptsFromElement(menuPage);
  executeInlineScripts(menuPage);

  // Wait for the user to click the "Start Experiment" button
  await new Promise((resolve) => {
    function handleClick(event) {
      if (event.target.id.startsWith("button_")) {
        console.log("Button clicked:", event.target.id);
        document.body.removeEventListener("click", handleClick);
        cleanupDynamicScripts(); // Cleanup added scripts
        menuPage.remove(); // Remove the confirmation page
        resolve();
      }
    }
    document.body.addEventListener("click", handleClick);
  });
}
