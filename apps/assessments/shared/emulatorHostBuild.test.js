// @vitest-environment node
// (The suite default is jsdom for variantPicker; this spec only imports bundler
// configs, and vite's esbuild dependency breaks under jsdom's TextEncoder.)
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_EMULATOR_AUTH_HOST } from './devEmulatorHost.cjs';

/**
 * Static-shape checks on every assessment's bundler config: which plugins carry
 * the FIREBASE_AUTH_EMULATOR_HOST key per mode. No bundle is built — the
 * plugins' recorded defaults/definitions reflect the config source directly.
 *
 * The invariant: serve.js (and roar-survey's main.js) call connectAuthEmulator()
 * on any non-empty value, so a deployed bundle carrying one would authenticate
 * against an emulator that issues unverified tokens for arbitrary UIDs. Since
 * dev builds default the value to the real emulator host (truthy), a config
 * refactor that merges the dev plugin into a production build guarantees that
 * leak — this spec catches it for every current and future assessment.
 */

const ASSESSMENTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const webpackAssessments = readdirSync(ASSESSMENTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(ASSESSMENTS_DIR, entry.name, 'webpack.config.cjs')))
  .map((entry) => entry.name);

async function loadWebpackConfig(name, dbmode, mode) {
  const { default: configFactory } = await import(
    pathToFileURL(path.join(ASSESSMENTS_DIR, name, 'webpack.config.cjs')).href
  );
  return configFactory({ dbmode }, { mode });
}

function environmentPluginDefault(config) {
  const plugin = (config.plugins ?? []).find(
    (p) =>
      p?.constructor?.name === 'EnvironmentPlugin' &&
      Object.prototype.hasOwnProperty.call(p.defaultValues ?? {}, 'FIREBASE_AUTH_EMULATOR_HOST'),
  );
  return plugin?.defaultValues.FIREBASE_AUTH_EMULATOR_HOST;
}

// EnvironmentPlugin is not the only way to bake the value in: webpack's
// DefinePlugin (and Vite's `define`) substitute it just as effectively. Assert
// production configs carry no such substitute, so a refactor that swaps
// mechanism cannot slip past the EnvironmentPlugin check.
function definesEmulatorHost(config) {
  return (config.plugins ?? []).some(
    (p) =>
      p?.constructor?.name === 'DefinePlugin' &&
      Object.keys(p.definitions ?? {}).some((key) => key.includes('FIREBASE_AUTH_EMULATOR_HOST')),
  );
}

beforeEach(() => {
  // The dev-mode assertions read the config's literal default; an ambient env
  // var would mask it.
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
});

describe.each(webpackAssessments)('%s webpack config — Auth emulator host', (name) => {
  it('does not inline the emulator host into a production build', async () => {
    const config = await loadWebpackConfig(name, 'production', 'production');
    expect(environmentPluginDefault(config)).toBeUndefined();
    expect(definesEmulatorHost(config)).toBe(false);
  });

  // dbmode and webpack mode are independent inputs; a mismatched invocation
  // must not resurrect the value through a dbmode-gated code path either.
  it('does not inline the emulator host when only dbmode says development', async () => {
    const config = await loadWebpackConfig(name, 'development', 'production');
    expect(environmentPluginDefault(config)).toBeUndefined();
    expect(definesEmulatorHost(config)).toBe(false);
  });

  it('defaults the emulator host to the shared constant for local development', async () => {
    const config = await loadWebpackConfig(name, 'development', 'development');
    expect(environmentPluginDefault(config)).toBe(FIREBASE_EMULATOR_AUTH_HOST);
  });
});

describe('roar-survey vite config — Auth emulator host', () => {
  async function loadViteConfig(mode) {
    const { default: configFactory } = await import(
      pathToFileURL(path.join(ASSESSMENTS_DIR, 'roar-survey', 'vite.config.js')).href
    );
    return configFactory({ mode });
  }

  it.each(['production', 'staging'])('defines an empty emulator host for a %s build', async (mode) => {
    const config = await loadViteConfig(mode);
    expect(config.define['process.env.FIREBASE_AUTH_EMULATOR_HOST']).toBe('""');
  });

  it('defaults the emulator host to the shared constant for local development', async () => {
    const config = await loadViteConfig('development');
    expect(config.define['process.env.FIREBASE_AUTH_EMULATOR_HOST']).toBe(JSON.stringify(FIREBASE_EMULATOR_AUTH_HOST));
  });
});
