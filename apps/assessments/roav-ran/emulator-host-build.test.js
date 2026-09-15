import { describe, expect, it, vi } from 'vitest';

const EMULATOR_HOST = '127.0.0.1:9099';

/**
 * Loads the webpack config factory for a given mode with the Auth emulator host
 * set, and reports whether the resulting config would inline that value into the
 * bundle.
 *
 * `EnvironmentPlugin` is what performs the inlining, so its presence with this key
 * is the thing under test — checking the plugin list avoids running a real build.
 */
async function inlinesEmulatorHost(mode) {
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', EMULATOR_HOST);
  try {
    const { default: configFactory } = await import('./webpack.config.cjs');
    const config = await configFactory({ dbmode: 'development' }, { mode });
    return (config.plugins ?? []).some(
      (plugin) =>
        plugin?.constructor?.name === 'EnvironmentPlugin' &&
        Object.prototype.hasOwnProperty.call(plugin.defaultValues ?? {}, 'FIREBASE_AUTH_EMULATOR_HOST'),
    );
  } finally {
    vi.unstubAllEnvs();
  }
}

describe('roav-ran webpack config — Auth emulator host', () => {
  // The production branch used to merge `devFirebaseConfig` alongside development.
  // serve.js calls connectAuthEmulator() on any non-empty value, so a deployed
  // build carrying one would authenticate against an emulator that issues
  // unverified tokens for arbitrary UIDs.
  it('does not inline the emulator host into a production build', async () => {
    await expect(inlinesEmulatorHost('production')).resolves.toBe(false);
  });

  it('still inlines the emulator host for local development', async () => {
    await expect(inlinesEmulatorHost('development')).resolves.toBe(true);
  });
});
