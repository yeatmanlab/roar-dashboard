import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  assertEmulatorNotEnabledInProduction,
  isFirebaseAuthEmulatorEnabled,
} from './assert-emulator-not-in-production.util';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isFirebaseAuthEmulatorEnabled', () => {
  it('returns true when FIREBASE_AUTH_EMULATOR_HOST holds a value', () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    expect(isFirebaseAuthEmulatorEnabled()).toBe(true);
  });

  it('returns false when FIREBASE_AUTH_EMULATOR_HOST is unset or empty', () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
    expect(isFirebaseAuthEmulatorEnabled()).toBe(false);

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    expect(isFirebaseAuthEmulatorEnabled()).toBe(false);
  });
});

describe('assertEmulatorNotEnabledInProduction', () => {
  it('throws in production when the emulator host is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

    expect(() => assertEmulatorNotEnabledInProduction()).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('does not throw in production when the emulator host is unset or empty', () => {
    vi.stubEnv('NODE_ENV', 'production');

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
    expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();
  });

  // The dev and CI flows that legitimately set the emulator host. Both leave NODE_ENV
  // below 'production', so the guard has to stay inert for them or it breaks the stack
  // it is meant to protect.
  it.each(['development', 'test', undefined])('does not throw when NODE_ENV is %s', (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

    expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();
  });
});
