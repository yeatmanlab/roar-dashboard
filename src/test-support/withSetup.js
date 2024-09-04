import { createApp } from 'vue';

/**
 * Test utility function to setup and mount a Vue component for testing composables.
 *
 * @source https://vuejs.org/guide/scaling-up/testing#testing-composables
 *
 * @param {Function} composable - The composable function to be tested.
 * @param {Object} options - An object containing the options for the Vue app.
 * @param {Array} options.plugins - An array of plugins to install in the Vue app.
 * @returns {Array} An array containing the result of the composable and the Vue app instance.
 */

export function withSetup(composable, options = []) {
  let result;
  const app = createApp({
    setup() {
      options?.plugins?.forEach(([plugin, options]) => {
        app.use(plugin, options);
      });
      result = composable();
      return () => {};
    },
  });

  app.mount(document.createElement('div'));
  return [result, app];
}
