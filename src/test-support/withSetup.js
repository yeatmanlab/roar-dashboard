import { createApp } from 'vue';

/**
 * Test utility function to setup and mount a Vue component for testing composables.
 *
 * @source https://vuejs.org/guide/scaling-up/testing#testing-composables
 * @param {Function} composable - The composable function to be tested.
 * @returns {Array} An array containing the result of the composable and the Vue app instance.
 */

export function withSetup(composable) {
  let result;
  const app = createApp({
    setup() {
      result = composable();
      return () => {};
    },
  });

  app.mount(document.createElement('div'));
  return [result, app];
}
