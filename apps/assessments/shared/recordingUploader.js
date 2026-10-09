import { connectStorageEmulator, getStorage, ref, uploadBytesResumable } from 'firebase/storage';

/**
 * Fallback Storage emulator port when only FIREBASE_AUTH_EMULATOR_HOST is set — the canonical
 * port from `docker/firebase-emulator/firebase.json` (`emulators.storage.port`). Stacks that
 * publish the Storage emulator on a different host port (the assessment stack uses 9197 so it
 * can run alongside the platform stack) inject FIREBASE_STORAGE_EMULATOR_HOST instead.
 */
const DEFAULT_STORAGE_EMULATOR_PORT = 9199;

/** `connectStorageEmulator` may be called at most once per storage instance. */
const emulatorConnected = new WeakSet();

/**
 * Resolves the Storage emulator address from the environment, if one is running.
 *
 * `FIREBASE_STORAGE_EMULATOR_HOST` wins when injected; otherwise the auth emulator's host is
 * reused with the canonical storage port, since every assessment already injects that one.
 *
 * @returns {{ host: string, port: number } | undefined} The address, or undefined outside the emulator
 */
function resolveStorageEmulatorAddress() {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) return undefined;

  // Tolerate the scheme-prefixed form firebase-tools uses for its own analogous variable
  // ('http://127.0.0.1:9199') — without the strip it would parse to host 'http' and port NaN.
  const storageEmulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.replace(/^https?:\/\//, '');
  const [host, port] = storageEmulatorHost ? storageEmulatorHost.split(':') : [authEmulatorHost.split(':')[0]];

  return {
    host: host || '127.0.0.1',
    port: port ? Number(port) : DEFAULT_STORAGE_EMULATOR_PORT,
  };
}

/**
 * A `gs://` URI naming a bucket and nothing else.
 *
 * Firebase treats the two near-miss shapes in opposite, equally unhelpful ways: `gs://b/prefix`
 * makes `getStorage` throw `invalid-default-bucket`, which from serve.js module scope takes the
 * whole harness down, while a bare `my-bucket` or an `https://` URL is silently accepted as a
 * literal bucket name and uploads then go somewhere that has never existed. Both are rejected
 * here so they degrade the same way everything else in this helper does.
 */
const BUCKET_URI_PATTERN = /^gs:\/\/[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]\/?$/;

/**
 * Validates a destination bucket and strips any trailing slash.
 *
 * Normalising here rather than at the point of use keeps the URI handed to `getStorage` and the
 * one reported as `bucketUri` identical — the SDK composes `storagePath` from the latter.
 *
 * @param {string} bucketUri - Candidate bucket URI
 * @returns {string | undefined} The canonical `gs://bucket` form, or undefined if unusable
 */
function normalizeBucketUri(bucketUri) {
  if (!BUCKET_URI_PATTERN.test(bucketUri)) return undefined;
  return bucketUri.replace(/\/+$/, '');
}

/**
 * Builds the uploader the assessment SDK expects at `ctx.recordings`.
 *
 * The SDK owns the object path, the upload queue, concurrency, and flush semantics; this owns
 * only the transport. It lives in the harness rather than in the SDK because a Firebase Storage
 * handle is bound to the `firebase/storage` module instance that created it — so the module
 * that initializes the app has to be the module that opens the bucket. Keeping the SDK side a
 * plain callback is also what makes the SDK provider-agnostic.
 *
 * Under the emulator the destination is the app's own default bucket, which the emulator
 * creates on first write. Outside it, the caller must name a bucket: there is no safe guess,
 * and guessing is what this seam exists to remove. No caller names one yet, so in staging and
 * production this returns undefined and recording uploads are disabled with a logged error
 * rather than failing silently mid-upload — see
 * https://github.com/yeatmanlab/roar-project-management/issues/2167 for the bucket provisioning
 * and the `bucketUri` wiring that turns them on.
 *
 * @param {import('firebase/app').FirebaseApp} app - The harness's Firebase app
 * @param {object} [options] - Uploader options
 * @param {string} [options.bucketUri] - Destination bucket as a `gs://bucket` URI. Required
 *   outside the emulator; ignored under it.
 * @returns {import('@roar-platform/assessment-sdk').RecordingUploader | undefined} The uploader,
 *   or `undefined` when no usable destination resolves — the caller then leaves `ctx.recordings`
 *   unset, so `uploadFile` throws a named SDK error at the call site rather than taking down a
 *   harness whose assessment may never upload at all.
 */
export function createRecordingUploader(app, { bucketUri } = {}) {
  const emulator = resolveStorageEmulatorAddress();
  const defaultBucket = app.options.storageBucket;
  const requested = emulator ? defaultBucket && `gs://${defaultBucket}` : bucketUri;

  // Error, not warn, on both paths below: every recording captured this session is discarded,
  // and the only other signal is a per-trial console.error from the capture view's catch.
  if (!requested) {
    console.error(
      '[assessment-shared] No recordings bucket resolved — recording uploads are disabled and ' +
        'every recording captured in this session will be discarded.',
    );
    return undefined;
  }

  const destination = normalizeBucketUri(requested);
  if (!destination) {
    console.error(
      `[assessment-shared] Unusable recordings bucket "${requested}" — expected a bare gs://bucket ` +
        'URI with no path. Recording uploads are disabled and every recording captured in this ' +
        'session will be discarded.',
    );
    return undefined;
  }

  const storage = emulator ? getStorage(app) : getStorage(app, destination);

  if (emulator && !emulatorConnected.has(storage)) {
    connectStorageEmulator(storage, emulator.host, emulator.port);
    emulatorConnected.add(storage);
  }

  return {
    bucketUri: destination,
    upload: ({ path, fileOrBlob, customMetadata }) =>
      // UploadTask is a thenable: it resolves once the resumable upload completes and rejects
      // on error, which is the entire contract the SDK's queue needs.
      uploadBytesResumable(ref(storage, path), fileOrBlob, customMetadata ? { customMetadata } : undefined).then(
        () => undefined,
      ),
  };
}
