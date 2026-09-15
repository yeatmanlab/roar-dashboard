import { describe, it, expect } from 'vitest';
import {
  EMULATOR_ENV_VARS,
  assertEmulatorDisabledForDeployedBuild,
  findEnabledEmulatorEnvVars,
  resolveIsFirebaseEmulatorEnabled,
} from './emulator-guard';

const EMULATOR_HOST = '127.0.0.1:9099';

describe('findEnabledEmulatorEnvVars', () => {
  it('reports the auth host when it holds a value', () => {
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST })).toEqual([
      'VITE_FIREBASE_EMULATOR_AUTH_HOST',
    ]);
  });

  it('reports the legacy flag for true and the string "true" only', () => {
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_ENABLED: true })).toEqual([
      'VITE_FIREBASE_EMULATOR_ENABLED',
    ]);
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_ENABLED: 'true' })).toEqual([
      'VITE_FIREBASE_EMULATOR_ENABLED',
    ]);
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_ENABLED: 'false' })).toEqual([]);
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_ENABLED: '' })).toEqual([]);
  });

  it('reports nothing for an empty or unrelated environment', () => {
    expect(findEnabledEmulatorEnvVars({})).toEqual([]);
    expect(findEnabledEmulatorEnvVars({ VITE_FIREBASE_EMULATOR_AUTH_HOST: '' })).toEqual([]);
    expect(findEnabledEmulatorEnvVars({ VITE_ROAR_API_BASE_URL: 'https://api.example.com' })).toEqual([]);
  });

  it('reports every enabled variable, not just the first', () => {
    expect(
      findEnabledEmulatorEnvVars({
        VITE_FIREBASE_EMULATOR_AUTH_HOST: EMULATOR_HOST,
        VITE_FIREBASE_EMULATOR_ENABLED: 'true',
      }),
    ).toEqual([...EMULATOR_ENV_VARS]);
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
