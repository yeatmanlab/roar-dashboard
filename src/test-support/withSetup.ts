import { createApp, App, Plugin } from 'vue';

interface WithSetupOptions {
  plugins?: [Plugin, any][];
}

/**
 * Test utility function to setup and mount a Vue component for testing composables.
 *
 * @source https://vuejs.org/guide/scaling-up/testing#testing-composables
 *
 * @param composable - The composable function to be tested.
 * @param options - An object containing the options for the Vue app.
 * @param options.plugins - An array of plugins to install in the Vue app.
 * @returns An array containing the result of the composable and the Vue app instance.
 */
export function withSetup<T>(composable: () => T, options: WithSetupOptions = {}): [T, App] {
  let result: T | undefined;
  const app = createApp({
    setup() {
      options?.plugins?.forEach(([plugin, pluginOptions]) => {
        app.use(plugin, pluginOptions);
      });
      result = composable();
      return () => {};
    },
  });

  app.mount(document.createElement('div'));
  if (!result) {
    throw new Error('Composable did not return a result');
  }
  return [result, app];
} 