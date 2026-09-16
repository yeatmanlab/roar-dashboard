import { describe, expect, it } from 'vitest';

/**
 * Static-shape checks on the webpack config: which plugins carry the
 * FIREBASE_AUTH_EMULATOR_HOST key per mode. No bundle is built and no env
 * value is involved — EnvironmentPlugin's defaults reflect the literal `''`
 * in the config, not ambient process.env, so stubbing the variable here
 * would assert nothing. `serve.js` calls connectAuthEmulator() on any
 * non-empty value, so a deployed bundle carrying one would authenticate
 * against an emulator that issues unverified tokens for arbitrary UIDs.
 */

/**
 * Whether the config for the given mode installs the EnvironmentPlugin that
 * surfaces the emulator host to the bundle.
 */
async function inlinesEmulatorHost(mode) {
  const { default: configFactory } = await import('./webpack.config.cjs');
  const config = await configFactory({ dbmode: 'development' }, { mode });
  return (config.plugins ?? []).some(
    (plugin) =>
      plugin?.constructor?.name === 'EnvironmentPlugin' &&
      Object.prototype.hasOwnProperty.call(plugin.defaultValues ?? {}, 'FIREBASE_AUTH_EMULATOR_HOST'),
  );
}

describe('roav-ran webpack config — Auth emulator host', () => {
  // The production branch used to merge `devFirebaseConfig` alongside
  // development, baking whatever the build environment held into the bundle.
  it('does not inline the emulator host into a production build', async () => {
    await expect(inlinesEmulatorHost('production')).resolves.toBe(false);
  });

  it('still inlines the emulator host for local development', async () => {
    await expect(inlinesEmulatorHost('development')).resolves.toBe(true);
  });

  // EnvironmentPlugin is not the only way to bake the value in: roar-survey
  // injects the same variable through Vite's `define`, and webpack's
  // DefinePlugin is the equivalent here. Assert the production config carries
  // no such substitute, so a refactor that swaps mechanism cannot slip past
  // the presence check above.
  it('defines no substitute for the emulator host in a production build', async () => {
    const { default: configFactory } = await import('./webpack.config.cjs');
    const config = await configFactory({ dbmode: 'development' }, { mode: 'production' });
    const definesEmulatorHost = (config.plugins ?? []).some(
      (plugin) =>
        plugin?.constructor?.name === 'DefinePlugin' &&
        Object.keys(plugin.definitions ?? {}).some((key) => key.includes('FIREBASE_AUTH_EMULATOR_HOST')),
    );
    expect(definesEmulatorHost).toBe(false);
  });
});
