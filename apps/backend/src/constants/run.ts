/**
 * Sentinel UUID used as the `administrationId` for anonymous runs.
 *
 * The assessment DB requires `administration_id NOT NULL`, so anonymous runs
 * (which have no real administration context) use this nil UUID instead of NULL.
 * This avoids nullable column complications while clearly marking the run as
 * not belonging to any real administration.
 */
export const ANONYMOUS_RUN_ADMINISTRATION_ID = '00000000-0000-0000-0000-000000000000';
