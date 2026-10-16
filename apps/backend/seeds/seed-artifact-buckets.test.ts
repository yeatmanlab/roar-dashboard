import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTIFACT_BUCKET_SUFFIXES } from '@roar-platform/assessment-schema';
import { runSeedArtifactBuckets } from './seed-artifact-buckets';

/**
 * The seeder's only logic is how it interprets the create-bucket response, so that
 * is what this covers: 409 is success because the step runs on every `npm start`,
 * and anything else must throw rather than leave a stack whose buckets silently do
 * not exist — a signed PUT to a missing bucket returns 404 at upload time, far from
 * here.
 */
const ENDPOINT = 'http://fake-gcs.test:4443';
const BUCKET_COUNT = Object.keys(ARTIFACT_BUCKET_SUFFIXES).length;

describe('runSeedArtifactBuckets', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('GCS_API_ENDPOINT', ENDPOINT);
    vi.stubEnv('GCLOUD_PROJECT', 'demo-roar');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates one bucket per assessment, named from the suffix map', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await runSeedArtifactBuckets();

    expect(fetchMock).toHaveBeenCalledTimes(BUCKET_COUNT);
    const names = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string).name);
    expect(names).toEqual(Object.values(ARTIFACT_BUCKET_SUFFIXES).map((suffix) => `demo-roar-${suffix}`));
  });

  it('treats an existing bucket as success', async () => {
    // The step runs on every `npm start`, so 409 is the steady state, not an error.
    fetchMock.mockResolvedValue({ ok: false, status: 409, text: async () => 'Conflict' });

    await expect(runSeedArtifactBuckets()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(BUCKET_COUNT);
  });

  it('throws on any other failure, naming the bucket', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    await expect(runSeedArtifactBuckets()).rejects.toThrow(/Failed to create bucket demo-roar-\S+: 500 boom/);
  });

  it('stops at the first unexpected failure rather than pressing on', async () => {
    // Pressing on would report partial success and leave uploads failing later.
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue({ ok: false, status: 503, text: async () => 'unavailable' });

    await expect(runSeedArtifactBuckets()).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('targets the configured endpoint and project', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await runSeedArtifactBuckets();

    expect(fetchMock.mock.calls[0]![0]).toBe(`${ENDPOINT}/storage/v1/b?project=demo-roar`);
  });
});
