import { createCipheriv, randomBytes, scrypt as scryptCb } from 'node:crypto';
import type { BinaryLike, ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Firebase Authentication hashes passwords with an internally modified scrypt. The bulk
 * `importUsers` path requires each record to carry an already-computed `passwordHash` +
 * `passwordSalt`, plus the project's hash parameters in `UserImportOptions.hash` so Firebase can
 * verify the password at sign-in. This module computes that hash.
 *
 * Algorithm (mirrors https://github.com/firebase/scrypt and its language ports):
 *   1. derivedKey = scrypt(password, passwordSalt ‖ saltSeparator, N = 2**memoryCost, r = rounds, p = 1, len = 64)
 *   2. passwordHash = AES-256-CTR( key = derivedKey[0..32], iv = 16 zero bytes ).encrypt(signerKey)
 *
 * Correctness is pinned by a known-answer test against Firebase's published vector
 * (see firebase-password-hash.test.ts).
 */

const scryptAsync = promisify(scryptCb) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const DERIVED_KEY_LENGTH = 64;
const AES_KEY_LENGTH = 32;
// Firebase's scrypt variant encrypts the signer key with a 16-byte all-zero IV.
const AES_IV = Buffer.alloc(16);
const PASSWORD_SALT_LENGTH = 16;

/**
 * Parameters for Firebase's modified scrypt. Every Firebase project has a unique set, found in the
 * console under Authentication → Users → ⋮ → "Password hash parameters". Provision them as backend
 * secrets — they must not live in source.
 */
export interface FirebaseScryptParams {
  /** base64-decoded `base64_signer_key`. */
  signerKey: Buffer;
  /** base64-decoded `base64_salt_separator`. */
  saltSeparator: Buffer;
  /** `rounds` parameter (scrypt block size `r`). */
  rounds: number;
  /** `mem_cost` parameter; the scrypt CPU/memory cost is `N = 2 ** memoryCost`. */
  memoryCost: number;
}

/**
 * Computes Firebase's modified-scrypt password hash for a known salt.
 *
 * @param password - The plaintext password.
 * @param passwordSalt - The per-user salt (raw bytes).
 * @param params - The Firebase project's scrypt parameters.
 * @returns The password hash as raw bytes (base64-encode for `importUsers` or comparison).
 */
export async function firebaseScryptHash(
  password: string,
  passwordSalt: Buffer,
  params: FirebaseScryptParams,
): Promise<Buffer> {
  const { signerKey, saltSeparator, rounds, memoryCost } = params;
  const cost = 2 ** memoryCost;
  const salt = Buffer.concat([passwordSalt, saltSeparator]);
  // scrypt needs ~128 * N * r bytes; give 2x headroom so larger mem_cost values don't trip maxmem.
  const maxmem = 128 * cost * rounds * 2;

  const derivedKey = await scryptAsync(Buffer.from(password), salt, DERIVED_KEY_LENGTH, {
    N: cost,
    r: rounds,
    p: 1,
    maxmem,
  });

  const cipher = createCipheriv('aes-256-ctr', derivedKey.subarray(0, AES_KEY_LENGTH), AES_IV);
  return Buffer.concat([cipher.update(signerKey), cipher.final()]);
}

/**
 * Generates a random per-user salt and returns the `{ passwordHash, passwordSalt }` pair for a
 * Firebase `importUsers` `UserImportRecord`. The caller must pass the same `params` to
 * `importUsers` via `UserImportOptions.hash` so Firebase can verify the password at sign-in.
 *
 * @param password - The plaintext password.
 * @param params - The Firebase project's scrypt parameters.
 * @returns The import-ready hash and salt buffers.
 */
export async function hashPasswordForImport(
  password: string,
  params: FirebaseScryptParams,
): Promise<{ passwordHash: Buffer; passwordSalt: Buffer }> {
  const passwordSalt = randomBytes(PASSWORD_SALT_LENGTH);
  const passwordHash = await firebaseScryptHash(password, passwordSalt, params);
  return { passwordHash, passwordSalt };
}

/**
 * Reads the Firebase scrypt parameters from the environment, base64-decoding the signer key and
 * salt separator. Throws a descriptive error if any are missing or malformed so a misconfigured
 * deployment fails loudly rather than silently producing unverifiable hashes.
 *
 * @param env - The environment to read from (defaults to `process.env`; injectable for tests).
 * @returns The parsed scrypt parameters.
 * @throws {Error} If any required variable is missing or `rounds`/`mem_cost` are not integers.
 */
export function getFirebaseScryptParamsFromEnv(env: NodeJS.ProcessEnv = process.env): FirebaseScryptParams {
  const signerKeyB64 = env.FIREBASE_SCRYPT_SIGNER_KEY;
  const saltSeparatorB64 = env.FIREBASE_SCRYPT_SALT_SEPARATOR;
  const roundsRaw = env.FIREBASE_SCRYPT_ROUNDS;
  const memoryCostRaw = env.FIREBASE_SCRYPT_MEM_COST;

  if (!signerKeyB64 || !saltSeparatorB64 || !roundsRaw || !memoryCostRaw) {
    const missing = [
      ['FIREBASE_SCRYPT_SIGNER_KEY', signerKeyB64],
      ['FIREBASE_SCRYPT_SALT_SEPARATOR', saltSeparatorB64],
      ['FIREBASE_SCRYPT_ROUNDS', roundsRaw],
      ['FIREBASE_SCRYPT_MEM_COST', memoryCostRaw],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    throw new Error(`Missing Firebase scrypt configuration: ${missing.join(', ')}`);
  }

  const rounds = Number(roundsRaw);
  const memoryCost = Number(memoryCostRaw);
  if (!Number.isInteger(rounds) || !Number.isInteger(memoryCost)) {
    throw new Error('FIREBASE_SCRYPT_ROUNDS and FIREBASE_SCRYPT_MEM_COST must be integers');
  }

  return {
    signerKey: Buffer.from(signerKeyB64, 'base64'),
    saltSeparator: Buffer.from(saltSeparatorB64, 'base64'),
    rounds,
    memoryCost,
  };
}
