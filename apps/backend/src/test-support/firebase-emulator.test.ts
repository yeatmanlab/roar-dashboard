import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { FirebaseAuthClient } from '../clients/firebase-auth.clients';
import { EMULATOR_TEST_PASSWORD, emulatorEmailFor, seedFirebaseAuthEmulator } from './firebase-emulator';

const createUserMock = FirebaseAuthClient.createUser as unknown as Mock;

const setEmulatorEnv = () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
};

const clearEmulatorEnv = () => {
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
};

beforeEach(() => {
  clearEmulatorEnv();
});

afterEach(() => {
  clearEmulatorEnv();
});

describe('emulatorEmailFor', () => {
  it('derives a deterministic test.local email from the UID', () => {
    expect(emulatorEmailFor('abc-123')).toBe('abc-123@test.local');
  });
});

describe('seedFirebaseAuthEmulator', () => {
  it('refuses to seed when FIREBASE_AUTH_EMULATOR_HOST is not set', async () => {
    await expect(seedFirebaseAuthEmulator([{ authId: 'uid-1' }])).rejects.toThrow(
      /FIREBASE_AUTH_EMULATOR_HOST is not set/,
    );
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('creates each user with deterministic email + shared password', async () => {
    setEmulatorEnv();
    createUserMock.mockResolvedValue({});

    const result = await seedFirebaseAuthEmulator([
      { authId: 'uid-1', nameFirst: 'Alice', nameLast: 'Smith' },
      { authId: 'uid-2', nameFirst: 'Bob', nameLast: null },
    ]);

    expect(createUserMock).toHaveBeenCalledTimes(2);
    expect(createUserMock).toHaveBeenNthCalledWith(1, {
      uid: 'uid-1',
      email: 'uid-1@test.local',
      password: EMULATOR_TEST_PASSWORD,
      emailVerified: true,
      displayName: 'Alice Smith',
    });
    expect(createUserMock).toHaveBeenNthCalledWith(2, {
      uid: 'uid-2',
      email: 'uid-2@test.local',
      password: EMULATOR_TEST_PASSWORD,
      emailVerified: true,
      displayName: 'Bob',
    });

    expect(result).toEqual([
      { authId: 'uid-1', email: 'uid-1@test.local', password: EMULATOR_TEST_PASSWORD },
      { authId: 'uid-2', email: 'uid-2@test.local', password: EMULATOR_TEST_PASSWORD },
    ]);
  });

  it('omits displayName when neither nameFirst nor nameLast is present', async () => {
    setEmulatorEnv();
    createUserMock.mockResolvedValue({});

    await seedFirebaseAuthEmulator([{ authId: 'uid-anon' }]);

    expect(createUserMock).toHaveBeenCalledWith({
      uid: 'uid-anon',
      email: 'uid-anon@test.local',
      password: EMULATOR_TEST_PASSWORD,
      emailVerified: true,
    });
  });

  it('treats auth/uid-already-exists as success (idempotent re-seed)', async () => {
    setEmulatorEnv();
    createUserMock.mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 'auth/uid-already-exists' }));

    const result = await seedFirebaseAuthEmulator([{ authId: 'uid-existing' }]);

    expect(result).toEqual([
      { authId: 'uid-existing', email: 'uid-existing@test.local', password: EMULATOR_TEST_PASSWORD },
    ]);
  });

  it('treats auth/email-already-exists as success (idempotent re-seed)', async () => {
    setEmulatorEnv();
    createUserMock.mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 'auth/email-already-exists' }));

    const result = await seedFirebaseAuthEmulator([{ authId: 'uid-x' }]);

    expect(result).toEqual([{ authId: 'uid-x', email: 'uid-x@test.local', password: EMULATOR_TEST_PASSWORD }]);
  });

  it('rethrows unexpected createUser errors', async () => {
    setEmulatorEnv();
    createUserMock.mockRejectedValueOnce(Object.assign(new Error('server down'), { code: 'auth/internal-error' }));

    await expect(seedFirebaseAuthEmulator([{ authId: 'uid-fail' }])).rejects.toThrow(/server down/);
  });
});
