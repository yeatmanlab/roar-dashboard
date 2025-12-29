/**
 * Check if the application is running in a test environment (e.g., Cypress E2E tests).
 *
 * This checks for a localStorage flag that Cypress tests set before running.
 * window.Cypress is not accessible from the app context in some setups,
 * so we use localStorage as a reliable cross-context signal.
 *
 * @returns {boolean} True if running in a test environment.
 */
const isTestEnv = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem('__E2E__') === 'true';
};

export default isTestEnv;
