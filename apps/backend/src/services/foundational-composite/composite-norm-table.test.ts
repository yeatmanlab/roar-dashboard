import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { loadCompositeNormTable, __clearCompositeNormTableCache } from './composite-norm-table';

// Mock only the network: a real PapaParse runs over the CSV text so parsing is exercised too.
vi.mock('axios', () => ({ default: { get: vi.fn() } }));

// Stub the URL helper so the test doesn't depend on the placeholder bucket.
vi.mock('@roar-platform/assessment-schema', () => ({
  foundationalComposite: {
    FOUNDATIONAL_COMPOSITE_SCORING_VERSION: 1,
    FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL: (version: number) => `https://example.test/composite_v${version}.csv`,
  },
}));

const mockedGet = vi.mocked(axios.get);

const CSV = ['ageMonths,thetaEstimate,percentile,standardScore', '96,1.5,50,100', '96,1.6,54,102'].join('\n');

/** A minimal AxiosResponse carrying CSV text. */
const csvResponse = (data: string): AxiosResponse<string> =>
  ({ data, status: 200, statusText: 'OK', headers: {}, config: { headers: {} } }) as unknown as AxiosResponse<string>;

describe('loadCompositeNormTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearCompositeNormTableCache();
  });

  it('skips a non-integer version without fetching', async () => {
    expect(await loadCompositeNormTable(Number.NaN)).toBeNull();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('fetches, parses, and caches; a second call reuses the cache (no re-fetch)', async () => {
    mockedGet.mockResolvedValue(csvResponse(CSV));

    const first = await loadCompositeNormTable(1);
    const second = await loadCompositeNormTable(1);

    expect(first).toHaveLength(2);
    expect(first?.[0]).toMatchObject({ ageMonths: 96, thetaEstimate: 1.5, percentile: 50, standardScore: 100 });
    expect(second).toBe(first); // same cached array reference
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads into a single request', async () => {
    let resolveGet!: (value: AxiosResponse<string>) => void;
    mockedGet.mockReturnValue(
      new Promise<AxiosResponse<string>>((resolve) => {
        resolveGet = resolve;
      }),
    );

    const p1 = loadCompositeNormTable(1);
    const p2 = loadCompositeNormTable(1);
    expect(mockedGet).toHaveBeenCalledTimes(1); // one request despite two concurrent calls

    resolveGet(csvResponse(CSV));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2); // both callers resolve off the same load
    expect(r1).toHaveLength(2);
  });

  it('returns null on a fetch failure and respects the cooldown on the next call', async () => {
    mockedGet.mockRejectedValue(new Error('404 Not Found'));

    expect(await loadCompositeNormTable(1)).toBeNull();
    // Within the cooldown window, the next call short-circuits to null without re-fetching.
    expect(await loadCompositeNormTable(1)).toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('treats a header-only (zero data rows) table as a failure', async () => {
    mockedGet.mockResolvedValue(csvResponse('ageMonths,thetaEstimate,percentile'));
    expect(await loadCompositeNormTable(1)).toBeNull();
  });
});
