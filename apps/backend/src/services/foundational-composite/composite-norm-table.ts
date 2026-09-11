import axios from 'axios';
import Papa from 'papaparse';
import type { LookupRow } from '@roar-platform/scoring-tables';
import { foundationalComposite } from '@roar-platform/assessment-schema';
import { logger } from '../../logger';

const { FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL, FOUNDATIONAL_COMPOSITE_SCORING_VERSION } = foundationalComposite;

/**
 * Cooldown before retrying a failed table load. The composite recompute runs on every
 * foundational trial write, so without a cooldown a missing/404 table would be re-fetched per
 * trial for the whole session (a failure mode flagged in the roar-letter lookup-table review).
 */
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

interface CacheEntry {
  /** Present once the table has loaded successfully (cached for the process lifetime). */
  rows?: LookupRow[];
  /** In-flight load, so concurrent callers share one network request. */
  inFlight?: Promise<LookupRow[] | null>;
  /** Epoch ms of the last failed load, used to apply {@link FAILURE_COOLDOWN_MS}. */
  lastFailureAt?: number;
}

// Versioned tables are immutable, so a successful parse is cached for the process lifetime.
const cacheByVersion = new Map<number, CacheEntry>();

async function fetchAndParse(url: string): Promise<LookupRow[]> {
  const response = await axios.get<string>(url, { responseType: 'text' });
  const parsed = Papa.parse<LookupRow>(response.data, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  // PapaParse collects per-row problems in `errors` while still returning the parseable rows in
  // `data`. A malformed row would otherwise silently drop out and skew norming — surface it.
  if (parsed.errors.length > 0) {
    logger.warn(
      { context: { url, errorCount: parsed.errors.length, firstError: parsed.errors[0] } },
      'Composite norm table had parse errors; some rows may be missing',
    );
  }
  if (parsed.data.length === 0) {
    throw new Error('foundational-composite norm table parsed to zero rows');
  }
  return parsed.data;
}

/**
 * Load (and cache) the parsed foundational-composite norm table for a scoring version.
 *
 * Returns `null` on any failure (missing/404 table, parse error, non-integer version) so the
 * caller degrades gracefully to writing the composite theta only. Successful loads are cached
 * for the process lifetime; concurrent callers share a single in-flight request; failures are
 * retried only after {@link FAILURE_COOLDOWN_MS} to avoid a fetch-per-trial.
 *
 * @param version - Scoring version (defaults to the schema default)
 * @returns Parsed rows, or `null` when the table can't be loaded
 */
export async function loadCompositeNormTable(
  version: number = FOUNDATIONAL_COMPOSITE_SCORING_VERSION,
): Promise<LookupRow[] | null> {
  // A malformed version would produce a guaranteed-404 URL (e.g. `..._vNaN.csv`).
  if (!Number.isInteger(version)) {
    logger.warn(
      { context: { version } },
      'Composite norm table requested with a non-integer version; skipping norming',
    );
    return null;
  }

  const existing = cacheByVersion.get(version);
  if (existing?.rows) {
    return existing.rows;
  }
  if (existing?.inFlight) {
    return existing.inFlight;
  }
  if (existing?.lastFailureAt !== undefined && Date.now() - existing.lastFailureAt < FAILURE_COOLDOWN_MS) {
    return null;
  }

  const url = FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL(version);
  const inFlight = fetchAndParse(url)
    .then((rows) => {
      cacheByVersion.set(version, { rows });
      return rows;
    })
    .catch((error: unknown) => {
      logger.warn(
        { err: error, context: { version, url } },
        'Failed to load foundational-composite norm table; composite written without normed scores',
      );
      cacheByVersion.set(version, { lastFailureAt: Date.now() });
      return null;
    });

  // Only the in-flight promise matters here; a prior `lastFailureAt` (cooldown already passed)
  // would just be confusing noise alongside it.
  cacheByVersion.set(version, { inFlight });
  return inFlight;
}

/** Test seam: clear the in-memory table cache between cases. */
export function __clearCompositeNormTableCache(): void {
  cacheByVersion.clear();
}
