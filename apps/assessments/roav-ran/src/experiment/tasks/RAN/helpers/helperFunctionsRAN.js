import { letterArrays, numberArrays } from '../stimulusInfo';

/**
 * Sets up the test configuration
 * @returns {Object} Test configuration object with Letter and Numbers settings
 */
export function setupTestConfig() {
  const randomLetterArray = letterArrays[Math.floor(Math.random() * letterArrays.length)];
  const randomNumberArray = numberArrays[Math.floor(Math.random() * numberArrays.length)];

  return {
    Letters: {
      dir: 'https://storage.googleapis.com/roav-ran/shared/Letters',
      stimulus: randomLetterArray,
      sizecm: 2,
      testname: 'Letters',
    },
    Numbers: {
      dir: 'https://storage.googleapis.com/roav-ran/shared/Numbers',
      stimulus: randomNumberArray,
      sizecm: 2,
      testname: 'Numbers',
    },
  };
}
