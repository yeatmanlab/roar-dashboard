/**
 * Origins for the external assets this package points at.
 *
 * These are **deployment configuration**, not shared vocabulary: a host running its own
 * infrastructure must be able to serve these assets from somewhere else. They are collected
 * here so there is one place to look, and every builder that uses them accepts an override
 * parameter defaulting to the value below.
 *
 * Deliberately *not* module-level mutable state (no `setOrigin()`): this package is pure
 * constants and pure functions, which is what makes it safe for consumers to bundle and
 * duplicate. A mutable default would let two copies diverge in behaviour, reintroducing the
 * hazard that purity avoids.
 */

/**
 * Public origin for ROAR's Google Cloud Storage asset buckets.
 *
 * Serves the normed scoring lookup tables (`<bucket>/scores/<name>_lookup_v<n>.csv`), the
 * ROAV stimuli bucket, and the ROAR-ReadAloud test-config corpora.
 */
export const GCS_ORIGIN = 'https://storage.googleapis.com' as const;

/**
 * Origin for the ROAR-ReadAloud device-calibration configs.
 *
 * Azure Blob Storage rather than GCS — these files predate the GCS consolidation and are
 * served from the eyetracking data host. Kept separate so overriding the GCS origin does not
 * silently redirect them somewhere that has never hosted them.
 */
export const READALOUD_DEVICE_CONFIG_ORIGIN = 'https://eyetrackingdata.blob.core.windows.net' as const;
