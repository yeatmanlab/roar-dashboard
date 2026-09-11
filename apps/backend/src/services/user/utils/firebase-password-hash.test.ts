import { describe, it, expect } from 'vitest';
import { firebaseScryptHash, hashPasswordForImport, getFirebaseScryptParamsFromEnv } from './firebase-password-hash';

/**
 * Official Firebase scrypt test vector, published at https://github.com/firebase/scrypt.
 * Hashing `password` with `salt` under these parameters MUST yield `expectedHash`. This is the
 * ground-truth proof that our implementation matches Firebase's — if it drifts, imported users
 * cannot sign in.
 */
const VECTOR = {
  signerKey: 'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
  saltSeparator: 'Bw==',
  rounds: 8,
  memoryCost: 14,
  salt: '42xEC+ixf3L2lw==',
  password: 'user1password',
  expectedHash: 'lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==',
} as const;

const vectorParams = () => ({
  signerKey: Buffer.from(VECTOR.signerKey, 'base64'),
  saltSeparator: Buffer.from(VECTOR.saltSeparator, 'base64'),
  rounds: VECTOR.rounds,
  memoryCost: VECTOR.memoryCost,
});

describe('firebaseScryptHash', () => {
  it('matches the official Firebase scrypt test vector', async () => {
    const hash = await firebaseScryptHash(VECTOR.password, Buffer.from(VECTOR.salt, 'base64'), vectorParams());
    expect(hash.toString('base64')).toBe(VECTOR.expectedHash);
  });

  it('produces a different hash for a different password', async () => {
    const hash = await firebaseScryptHash('not-the-password', Buffer.from(VECTOR.salt, 'base64'), vectorParams());
    expect(hash.toString('base64')).not.toBe(VECTOR.expectedHash);
  });
});

describe('hashPasswordForImport', () => {
  it('generates a 16-byte salt and a hash reproducible from that salt', async () => {
    const { passwordHash, passwordSalt } = await hashPasswordForImport(VECTOR.password, vectorParams());
    expect(passwordSalt).toHaveLength(16);
    // Re-hashing with the same salt reproduces the hash (deterministic given the salt).
    const rehash = await firebaseScryptHash(VECTOR.password, passwordSalt, vectorParams());
    expect(rehash.equals(passwordHash)).toBe(true);
  });

  it('uses a fresh random salt on each call', async () => {
    const a = await hashPasswordForImport(VECTOR.password, vectorParams());
    const b = await hashPasswordForImport(VECTOR.password, vectorParams());
    expect(a.passwordSalt.equals(b.passwordSalt)).toBe(false);
  });
});

describe('getFirebaseScryptParamsFromEnv', () => {
  const validEnv = {
    FIREBASE_SCRYPT_SIGNER_KEY: VECTOR.signerKey,
    FIREBASE_SCRYPT_SALT_SEPARATOR: VECTOR.saltSeparator,
    FIREBASE_SCRYPT_ROUNDS: String(VECTOR.rounds),
    FIREBASE_SCRYPT_MEM_COST: String(VECTOR.memoryCost),
  };

  it('parses and base64-decodes the configured params', () => {
    const params = getFirebaseScryptParamsFromEnv(validEnv);
    expect(params.rounds).toBe(8);
    expect(params.memoryCost).toBe(14);
    expect(params.signerKey.equals(Buffer.from(VECTOR.signerKey, 'base64'))).toBe(true);
    expect(params.saltSeparator.equals(Buffer.from(VECTOR.saltSeparator, 'base64'))).toBe(true);
  });

  it('throws listing the missing variables', () => {
    expect(() => getFirebaseScryptParamsFromEnv({})).toThrow(/FIREBASE_SCRYPT_SIGNER_KEY/);
  });

  it('throws when rounds or mem_cost are not integers', () => {
    expect(() => getFirebaseScryptParamsFromEnv({ ...validEnv, FIREBASE_SCRYPT_ROUNDS: 'abc' })).toThrow(/integers/);
  });
});
