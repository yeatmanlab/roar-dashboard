/**
 * Sentinel UUID used as the `administrationId` for anonymous runs.
 *
 * The assessment DB requires `administration_id NOT NULL`, so anonymous runs
 * (which have no real administration context) use this nil UUID instead of NULL.
 * This avoids nullable column complications while clearly marking the run as
 * not belonging to any real administration.
 */
export const ANONYMOUS_RUN_ADMINISTRATION_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Sentinel `task_id` / `task_variant_id` / `task_version` for the dedicated
 * foundational-composite run.
 *
 * The foundational composite is an aggregate over the `use_for_reporting` runs of the
 * Letter/Phoneme/Word/Sentence subtests for a `(user_id, administration_id)`, so it does
 * not belong to any single subtest run. It is stored on its own dedicated run instead.
 * `app.runs` requires non-null `task_id` / `task_variant_id` / `task_version`, so the
 * composite run uses these sentinels — the same pattern as
 * {@link ANONYMOUS_RUN_ADMINISTRATION_ID}. There is no FK from the assessment DB to the
 * core `tasks` / `task_variants` tables, so these IDs intentionally do not reference real
 * rows; they exist solely to mark a run as the composite run.
 *
 * Any query that counts runs or tests for run *existence* without scoping to a specific
 * (real) `task_variant_id` MUST exclude `COMPOSITE_RUN_TASK_ID`, so the synthetic run never
 * inflates a metric or stands in for real assessment data. Current consumers that exclude it:
 * `RunRepository.getRunStatsByAdministrationIds` (started/completed counts),
 * `RunRepository.getByAdministrationId` (blocks admin deletion),
 * `enrollment.utils.hasWithdrawnWithDataForAdmin` (withdrawn-with-data / unenrolled
 * inclusion), and `ReportRepository.getStudentAdministrations` Path A. Variant-scoped
 * queries are immune because the sentinel `task_variant_id` is never an assigned variant.
 */
export const COMPOSITE_RUN_TASK_ID = '00000000-0000-0000-0000-0000000c0a17';
export const COMPOSITE_RUN_TASK_VARIANT_ID = '00000000-0000-0000-0000-0000000c0a18';
export const COMPOSITE_RUN_TASK_VERSION = 'foundational-composite-v1';
