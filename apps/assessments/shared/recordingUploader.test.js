import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectStorageEmulator, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { createRecordingUploader } from './recordingUploader.js';

/**
 * These cases carry over the Storage-resolution contract that used to live in the SDK
 * (`resolveStorageBucket`), which moved here when `ctx.recordings` became host-supplied. The
 * emulator address derivation is the load-bearing part: get it wrong and dev recordings go to
 * a port nothing is listening on, which looks identical to an upload that simply never fired.
 */

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(),
  ref: vi.fn((storage, path) => ({ storage, path })),
  uploadBytesResumable: vi.fn(() => Promise.resolve({ ref: {} })),
}));

const PROD_BUCKET = 'gs://recordings-bucket';

/** A distinct object per call, so the connect-once WeakSet can't leak between cases. */
function stubStorage() {
  const storage = { id: Symbol('storage') };
  getStorage.mockReturnValue(storage);
  return storage;
}

function fakeApp(storageBucket = 'demo-roar.appspot.com') {
  return { options: { storageBucket } };
}

beforeEach(() => {
  // Not vi.unstubAllEnvs() alone: that restores the *real* environment, and an assessment dev
  // shell exports both of these — which would silently route the non-emulator cases below down
  // the emulator path. Stubbing to undefined deletes them for the duration of the test.
  vi.unstubAllEnvs();
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
  vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', undefined);
  stubStorage();
});

describe('createRecordingUploader under the emulator', () => {
  beforeEach(() => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9097');
  });

  it("uploads to the app's own default bucket rather than a named one", () => {
    const app = fakeApp();

    const uploader = createRecordingUploader(app, { bucketUri: PROD_BUCKET });

    // No second argument: the emulator creates the default bucket on first write, and the
    // production bucket must not be contacted from a dev machine even if one is configured.
    expect(getStorage).toHaveBeenCalledWith(app);
    expect(uploader.bucketUri).toBe('gs://demo-roar.appspot.com');
  });

  it('derives the emulator address from the auth host and the canonical storage port', () => {
    createRecordingUploader(fakeApp());

    expect(connectStorageEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9199);
  });

  it('honors FIREBASE_STORAGE_EMULATOR_HOST over the auth-derived address', () => {
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:9197');

    createRecordingUploader(fakeApp());

    expect(connectStorageEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9197);
  });

  it('falls back to the auth host when FIREBASE_STORAGE_EMULATOR_HOST is empty', () => {
    // devWebpackConfig.cjs bakes in '' for platform-context dev, where the auth host is
    // overridden but the storage port must stay canonical. Treating '' as a real value would
    // send recordings to a dead port, which is indistinguishable from an upload never firing.
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', '');

    createRecordingUploader(fakeApp());

    expect(connectStorageEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9199);
  });

  it('tolerates a scheme-prefixed FIREBASE_STORAGE_EMULATOR_HOST', () => {
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', 'http://127.0.0.1:9199');

    createRecordingUploader(fakeApp());

    // Without the scheme strip this would parse to host 'http' and port NaN.
    expect(connectStorageEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9199);
  });

  it('connects a given storage instance only once', () => {
    const app = fakeApp();

    createRecordingUploader(app);
    createRecordingUploader(app);

    // connectStorageEmulator throws if the instance has already been used.
    expect(connectStorageEmulator).toHaveBeenCalledTimes(1);
  });

  it('disables uploads when the app has no default bucket to fall back to', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A config without `storageBucket` — getStorage() would have no default to resolve.
    expect(createRecordingUploader({ options: {} })).toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

describe('createRecordingUploader outside the emulator', () => {
  it('opens the bucket the caller named', () => {
    const app = fakeApp();

    const uploader = createRecordingUploader(app, { bucketUri: PROD_BUCKET });

    expect(getStorage).toHaveBeenCalledWith(app, PROD_BUCKET);
    expect(connectStorageEmulator).not.toHaveBeenCalled();
    expect(uploader.bucketUri).toBe(PROD_BUCKET);
  });

  it.each([
    ['a path-bearing URI Firebase would throw on', 'gs://recordings-bucket/readaloud'],
    ['a bare bucket name Firebase would accept silently', 'recordings-bucket'],
    ['an https URL', 'https://storage.googleapis.com/recordings-bucket'],
  ])('disables uploads for %s rather than failing at boot', (_label, badUri) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    // getStorage() throws on the first shape and silently mis-targets on the other two, and
    // this runs at serve.js module scope — so an unguarded throw takes the harness down.
    expect(createRecordingUploader(fakeApp(), { bucketUri: badUri })).toBeUndefined();
    expect(getStorage).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it('strips a trailing slash so bucketUri and the opened bucket agree', () => {
    const app = fakeApp();

    const uploader = createRecordingUploader(app, { bucketUri: `${PROD_BUCKET}/` });

    // The SDK composes storagePath as `${bucketUri}/${path}`, so a surviving slash would
    // persist gs://recordings-bucket//task/... on the trial.
    expect(uploader.bucketUri).toBe(PROD_BUCKET);
    expect(getStorage).toHaveBeenCalledWith(app, PROD_BUCKET);
  });

  it('disables uploads rather than guessing a bucket', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The app's default bucket is deliberately NOT a fallback here: recordings are student
    // data, and the default bucket is the one serving public stimuli.
    expect(createRecordingUploader(fakeApp())).toBeUndefined();
    expect(getStorage).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });
});

describe('upload', () => {
  it('attaches customMetadata when the SDK supplies it', async () => {
    const storage = stubStorage();
    const uploader = createRecordingUploader(fakeApp(), {
      bucketUri: PROD_BUCKET,
    });
    const fileOrBlob = new Blob(['audio']);

    await uploader.upload({
      path: 'task/run/clip.webm',
      fileOrBlob,
      customMetadata: { trialId: 't1' },
    });

    expect(ref).toHaveBeenCalledWith(storage, 'task/run/clip.webm');
    expect(uploadBytesResumable).toHaveBeenCalledWith(expect.anything(), fileOrBlob, {
      customMetadata: { trialId: 't1' },
    });
  });

  it('omits the metadata argument entirely when there is none', async () => {
    const uploader = createRecordingUploader(fakeApp(), {
      bucketUri: PROD_BUCKET,
    });

    await uploader.upload({
      path: 'task/run/clip.webm',
      fileOrBlob: new Blob(['audio']),
    });

    expect(uploadBytesResumable).toHaveBeenCalledWith(expect.anything(), expect.anything(), undefined);
  });

  it('resolves undefined so the SDK queue cannot come to depend on the snapshot', async () => {
    const uploader = createRecordingUploader(fakeApp(), {
      bucketUri: PROD_BUCKET,
    });

    await expect(uploader.upload({ path: 'p', fileOrBlob: new Blob(['a']) })).resolves.toBeUndefined();
  });

  it('rejects when the upload fails, so the queue can mark the task failed', async () => {
    uploadBytesResumable.mockReturnValueOnce(Promise.reject(new Error('storage/unauthorized')));
    const uploader = createRecordingUploader(fakeApp(), {
      bucketUri: PROD_BUCKET,
    });

    await expect(uploader.upload({ path: 'p', fileOrBlob: new Blob(['a']) })).rejects.toThrow('storage/unauthorized');
  });
});
