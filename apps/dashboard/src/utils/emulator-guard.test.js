import { describe, it, expect } from 'vitest';
import { assertEmulatorDisabledForDeployedBuild, resolveIsFirebaseEmulatorEnabled } from './emulator-guard';

const EMULATOR_HOST = '127.0.0.1:9099';

// Which values count as "emulator enabled" is the load-bearing detail: the build
// guard and the runtime flag share one predicate map, so these cases are asserted
// through both public entry points rather than against the map directly.
describe('which values enable the emulator', () => {
  it.each([
    ['the auth host holding a value', { VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST }],
    ['the legacy flag as boolean true', { VITE_FIREBASE_EMULATOR_ENABLED: true }],
    ['the legacy flag as the string "true"', { VITE_FIREBASE_EMULATOR_ENABLED: 'true' }],
  ])('treats %s as enabled', (_label, env) => {
    expect(resolveIsFirebaseEmulatorEnabled({ MODE: 'development', ...env })).toBe(true);
    expect(() => assertEmulatorDisabledForDeployedBuild('production', env)).toThrow(/emulator/i);
  });

  it.each([
    ['an empty environment', {}],
    ['an empty auth host', { VITE_FIREBASE_EMULATOR_AUTH_HOST: '' }],
    ['the legacy flag as "false"', { VITE_FIREBASE_EMULATOR_ENABLED: 'false' }],
    ['the legacy flag as an empty string', { VITE_FIREBASE_EMULATOR_ENABLED: '' }],
    ['an unrelated variable', { VITE_ROAR_API_BASE_URL: 'https://api.example.com' }],
  ])('treats %s as disabled', (_label, env) => {
    expect(resolveIsFirebaseEmulatorEnabled({ MODE: 'development', ...env })).toBe(false);
    expect(() => assertEmulatorDisabledForDeployedBuild('production', env)).not.toThrow();
  });

  it('names every enabled variable in the build error, not just the first', () => {
    expect(() =>
      assertEmulatorDisabledForDeployedBuild('production', {
        VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST,
        VITE_FIREBASE_EMULATOR_ENABLED: 'true',
      }),
    ).toThrow(/VITE_FIREBASE_EMULATOR_AUTH_HOST, VITE_FIREBASE_EMULATOR_ENABLED/);
  });
});

describe('assertEmulatorDisabledForDeployedBuild', () => {
  it.each(['staging', 'production'])('throws for a %s build with the emulator auth host set', (mode) => {
    expect(() =>
      assertEmulatorDisabledForDeployedBuild(mode, { VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST }),
    ).toThrow(/VITE_FIREBASE_EMULATOR_AUTH_HOST/);
  });

  it.each(['staging', 'production'])('throws for a %s build with the legacy flag set', (mode) => {
    expect(() => assertEmulatorDisabledForDeployedBuild(mode, { VITE_FIREBASE_EMULATOR_ENABLED: 'true' })).toThrow(
      /VITE_FIREBASE_EMULATOR_ENABLED/,
    );
  });

  it.each(['staging', 'production'])('allows a %s build with no emulator variable set', (mode) => {
    expect(() => assertEmulatorDisabledForDeployedBuild(mode, {})).not.toThrow();
  });

  // Local dev builds in `development` mode with the emulator host set, and the CI
  // e2e job builds the dashboard in `development` too. Breaking either would defeat
  // the purpose, so both are pinned here.
  it.each(['development', 'test'])('allows a %s build with the emulator enabled', (mode) => {
    expect(() =>
      assertEmulatorDisabledForDeployedBuild(mode, {
        VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST,
        VITE_FIREBASE_EMULATOR_ENABLED: 'true',
      }),
    ).not.toThrow();
  });
});

describe('resolveIsFirebaseEmulatorEnabled', () => {
  it('returns true in a development build with the emulator enabled', () => {
    expect(
      resolveIsFirebaseEmulatorEnabled({ MODE: 'development', VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST }),
    ).toBe(true);
  });

  it('returns false when no emulator variable is set', () => {
    expect(resolveIsFirebaseEmulatorEnabled({ MODE: 'production' })).toBe(false);
    expect(resolveIsFirebaseEmulatorEnabled({ MODE: 'development' })).toBe(false);
    expect(resolveIsFirebaseEmulatorEnabled({})).toBe(false);
  });

  it.each(['staging', 'production'])('throws rather than returning true in a %s build', (mode) => {
    expect(() =>
      resolveIsFirebaseEmulatorEnabled({ MODE: mode, VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST }),
    ).toThrow(/emulator/i);
  });
});
