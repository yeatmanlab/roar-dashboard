/**
 * Foundational-composite norming config.
 *
 * The foundational composite is computed on the backend (it aggregates the Letter/Phoneme/Word/
 * Sentence reporting runs), so unlike the per-assessment tables this one is consumed server-side.
 * The versioned-URL helper lives here alongside `PA_SCORE_TABLE_URL` / `SWR_SCORE_TABLE_URL` so
 * every score-table URL has a single home; the keying strategy + match precision live with the
 * backend norming service that consumes them.
 */

/** Default scoring version for the composite lookup table. */
export const FOUNDATIONAL_COMPOSITE_SCORING_VERSION = 1 as const;

/**
 * Versioned URL for the foundational-composite lookup table.
 *
 * PLACEHOLDER — the composite lookup table is not published yet. The bucket and filename below
 * mirror the per-assessment convention (`https://storage.googleapis.com/<bucket>/scores/<name>_v<version>.csv`)
 * but must be confirmed against the real published artifact before the backend norming is enabled.
 *
 * @param version - Scoring version (defaults to {@link FOUNDATIONAL_COMPOSITE_SCORING_VERSION})
 * @returns The lookup-table CSV URL
 */
export const FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL = (
  version: number = FOUNDATIONAL_COMPOSITE_SCORING_VERSION,
): string => `https://storage.googleapis.com/roar-foundational/foundational/scores/composite_lookup_v${version}.csv`;
