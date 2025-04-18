import { createApp, App, Plugin } from 'vue';

// Define a more specific type for the options if possible,
// otherwise keep it flexible.
// This assumes plugins are passed as tuples [Plugin, options?]
type PluginOptionTuple = [Plugin] | [Plugin, any];

interface WithSetupOptions {
  plugins?: PluginOptionTuple[];
}

/**
 * Test utility function to setup and mount a Vue component for testing composables.
 *
 * @source https://vuejs.org/guide/scaling-up/testing#testing-composables
 *
 * @template T The return type of the composable function.
 * @param {() => T} composable - The composable function to be tested.
 * @param {WithSetupOptions} [options] - Optional configuration for the Vue app.
 * @param {PluginOptionTuple[]} [options.plugins] - An array of plugins (and optionally their options) to install.
 * @returns {[T, App]} An array containing the result of the composable and the Vue app instance.
 */
export function withSetup<T>(composable: () => T, options?: WithSetupOptions): [T, App] {
  let result: T | undefined; // Initialize as undefined, will be assigned in setup

  const app = createApp({
    setup() {
      // Use optional chaining and provide a default empty array for plugins
      (options?.plugins ?? []).forEach(([plugin, pluginOptions]) => {
        // Pass options to app.use if they exist
        if (pluginOptions !== undefined) {
            app.use(plugin, pluginOptions);
        } else {
            app.use(plugin);
        }
      });
      result = composable();
      // return a dummy render function
      return () => {};
    },
  });

  // Ensure the mounting element exists (necessary in some test environments like Vitest with JSDOM)
  let div = document.getElementById('app');
  if (!div) {
      div = document.createElement('div');
      div.id = 'app';
      document.body.appendChild(div);
  }

  app.mount(div);

  // Type assertion: We know `result` will be assigned within `setup` before `mount` completes.
  return [result as T, app];
} 