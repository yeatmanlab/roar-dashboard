import { describe, it, expect, afterEach, vi } from 'vitest';
import { assertEmulatorNotEnabledOnDeployedService } from './emulator-guard.util';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertEmulatorNotEnabledOnDeployedService', () => {
  it('throws on a deployed service when the emulator host is set', () => {
    vi.stubEnv('K_SERVICE', 'roar-backend');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

    expect(() => assertEmulatorNotEnabledOnDeployedService()).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  // The Admin SDK treats any non-empty value as "use the emulator", so an empty
  // string is not the emulator being enabled and must not fail the boot.
  it('does not throw on a deployed service when the emulator host is unset or empty', () => {
    vi.stubEnv('K_SERVICE', 'roar-backend');

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
    expect(() => assertEmulatorNotEnabledOnDeployedService()).not.toThrow();

    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    expect(() => assertEmulatorNotEnabledOnDeployedService()).not.toThrow();
  });

  // Off a deployed service the guard must stay inert, whatever NODE_ENV says. The
  // assessment SDK's integration harness is the case that matters: it spawns a
  // local backend with NODE_ENV=production against the emulator, purely to dodge a
  // pino-pretty crash in bundled ESM. Keying on NODE_ENV alone killed that suite.
  it.each(['production', 'development', 'test', undefined])(
    'does not throw off a deployed service when NODE_ENV is %s',
    (nodeEnv) => {
      vi.stubEnv('K_SERVICE', undefined);
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');

      expect(() => assertEmulatorNotEnabledOnDeployedService()).not.toThrow();
    },
  );
});
