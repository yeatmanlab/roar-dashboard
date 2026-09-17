/**
 * @fileoverview module to support practiceIntroView
 * @module practiceIntroView
 */

import practice_intro_page from './practiceIntro.html';
import { loadScriptsFromElement, executeInlineScripts, cleanupDynamicScripts } from '../../shared/views/viewUtils.js';
import { giveAccess, startRecording, stopRecording, saveRecordings } from '../../shared/views/videoCapture.js';

/**
 * Displays a practice intro view with a sequential stimulus demo followed by a "Your turn!" prompt.
 *
 * The demo phase highlights each stimulus in the 2x3 grid one at a time, playing the corresponding
 * audio file. After all stimuli are highlighted, the view transitions to the practice phase showing
 * the full grid with a yellow continue button.
 *
 * @async
 * @function practiceIntroView
 * @param {Object} practiceConfig - Configuration for the practice intro.
 * @param {string[]} practiceConfig.stimuli - Array of 6 SVG filenames in row-major order (e.g. ['M.svg', 'A.svg', ...]).
 * @param {string} practiceConfig.stimulusDir - Base URL for stimulus images (e.g. 'https://storage.googleapis.com/roav-ran/shared/Letters').
 * @param {'letter'|'number'} practiceConfig.stimulusType - Type of stimuli, used to set title text.
 * @param {string[]} practiceConfig.demoAudioSrcs - Array of 6 audio file paths, one per stimulus. Empty string falls back to a timer.
 * @param {Object} config - Global experiment configuration object.
 * @returns {Promise<void>} A promise that resolves when the view is completed.
 */
export async function practiceIntroView(practiceConfig, config) {
  await giveAccess(false, false);

  const practiceIntroHtml = practice_intro_page;

  const practiceIntroPage = document.createElement('div');
  practiceIntroPage.innerHTML = practiceIntroHtml;

  window.practiceIntroConfig = practiceConfig;
  window.practiceIntroAbortController = new AbortController();

  window.startPracticeRecording = startRecording;

  window.endPractice = async function () {
    await stopRecording();
    const timestamp = new Date().getTime();
    const ranType = window.practiceIntroConfig.assets.ranType;
    const filename = 'RAN_practice_' + ranType + '_' + timestamp + '.webm';

    try {
      let objectURL = await saveRecordings({
        filename,
        deviceConfig: window.deviceConfig,
        config,
        metadata: { stimulus: 'practice' },
      });
      // console.log("Saving Practice Recording to:", objectURL);
    } catch (error) {
      console.error('Error saving practice recording:', error);
    }
    document.dispatchEvent(new Event('pageComplete'));
  };

  document.body.appendChild(practiceIntroPage);

  await loadScriptsFromElement(practiceIntroPage);
  executeInlineScripts(practiceIntroPage);

  await new Promise((resolve) => {
    document.addEventListener(
      'pageComplete',
      () => {
        practiceIntroPage.remove();
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
  if (window.practiceIntroAbortController) {
    window.practiceIntroAbortController.abort();
    delete window.practiceIntroAbortController;
  }
  delete window.practiceIntroConfig;
  delete window.startPracticeRecording;
  delete window.endPractice;
  cleanupDynamicScripts();
}
