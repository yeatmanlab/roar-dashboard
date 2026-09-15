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
  it('throws on Cloud Run when the emulator host is set', () => {
    vi.stubEnv('K_SERVICE', 'roar-backend');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

    expect(() => assertEmulatorNotEnabledInProduction()).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('does not throw on Cloud Run when the emulator host is unset or empty', () => {
    vi.stubEnv('K_SERVICE', 'roar-backend');

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
    expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();
  });

  // Off Cloud Run the guard must stay inert, whatever NODE_ENV says. The
  // assessment SDK's integration harness is the case that matters: it spawns a
  // local backend with NODE_ENV=production against the emulator, purely to dodge a
  // pino-pretty crash in bundled ESM. Keying on NODE_ENV alone killed that suite.
  it.each(['production', 'development', 'test', undefined])(
    'does not throw off Cloud Run when NODE_ENV is %s',
    (nodeEnv) => {
      vi.stubEnv('K_SERVICE', undefined);
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

      expect(() => assertEmulatorNotEnabledInProduction()).not.toThrow();
    },
  );
});
