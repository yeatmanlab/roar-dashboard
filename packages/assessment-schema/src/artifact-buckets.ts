import { ROAM_ARTIFACT_BUCKET_SUFFIX } from './roam-apps/config.js';
import { LETTER_ARTIFACT_BUCKET_SUFFIX } from './roar-letter/config.js';
import { LEVANTE_ARTIFACT_BUCKET_SUFFIX } from './roar-levante-tasks/config.js';
import { MULTICHOICE_ARTIFACT_BUCKET_SUFFIX } from './roar-multichoice/config.js';
import { PA_ARTIFACT_BUCKET_SUFFIX } from './roar-pa/config.js';
import { READALOUD_ARTIFACT_BUCKET_SUFFIX } from './roar-readaloud/config.js';
import { SRE_ARTIFACT_BUCKET_SUFFIX } from './roar-sre/config.js';
import { SURVEY_ARTIFACT_BUCKET_SUFFIX } from './roar-survey/config.js';
import { SWR_ARTIFACT_BUCKET_SUFFIX } from './roar-swr/config.js';
import { ROAV_APPS_ARTIFACT_BUCKET_SUFFIX } from './roav-apps/config.js';
import { ROAV_RAN_ARTIFACT_BUCKET_SUFFIX } from './roav-ran/config.js';

/**
 * Artifact buckets: one per assessment, named `<admin-project-id>-<suffix>`.
 *
 * Student artifacts — read-aloud audio, RAN eyetracking video — go to a bucket per assessment
 * rather than one shared bucket, so bucket-level IAM can scope a scoring principal to a single
 * assessment's artifacts, and so retention can differ per artifact type.
 *
 * The name is composed at use time rather than configured, by the **backend** — it holds the admin
 * project ID in its own environment and mints the signed upload URL, so no client ever learns which
 * bucket its artifacts land in. That is an isolation property, not just a configuration one: a
 * hostile client cannot address a bucket it is never told the name of.
 *
 * Only the suffix lives here. The project ID is supplied by the caller and never hardcoded: this
 * package publishes to npm and must not name a ROAR deployment.
 *
 * This module lives beside `score-utils.ts` rather than in `constants/`, because it imports from
 * every assessment namespace while everything in `constants/` is a leaf those namespaces import
 * from.
 */

/**
 * Per-assessment bucket suffixes, keyed by the assessment's directory name — the same key the seed
 * registry, CI matrices, and hosting targets use.
 *
 * A suffix must be a lowercase DNS-style fragment short enough that `<project-id>-<suffix>` stays
 * within the limits GCS and GCP impose (63 and 30 characters). Both are asserted in this module's
 * test against a worst-case project ID, so adding an entry that cannot compose fails there rather
 * than at deploy time.
 *
 * These values currently match `apps/assessments/hosting-targets.json` entry for entry, but the
 * two are declared independently and must stay that way. Renaming a Hosting site suffix is cheap;
 * renaming a bucket that holds student artifacts is a data migration. **Changing one is not a
 * reason to change the other.**
 */
export const ARTIFACT_BUCKET_SUFFIXES = {
  'roam-apps': ROAM_ARTIFACT_BUCKET_SUFFIX,
  'roar-letter': LETTER_ARTIFACT_BUCKET_SUFFIX,
  'roar-levante-tasks': LEVANTE_ARTIFACT_BUCKET_SUFFIX,
  'roar-multichoice': MULTICHOICE_ARTIFACT_BUCKET_SUFFIX,
  'roar-pa': PA_ARTIFACT_BUCKET_SUFFIX,
  'roar-readaloud': READALOUD_ARTIFACT_BUCKET_SUFFIX,
  'roar-sre': SRE_ARTIFACT_BUCKET_SUFFIX,
  'roar-survey': SURVEY_ARTIFACT_BUCKET_SUFFIX,
  'roar-swr': SWR_ARTIFACT_BUCKET_SUFFIX,
  'roav-apps': ROAV_APPS_ARTIFACT_BUCKET_SUFFIX,
  'roav-ran': ROAV_RAN_ARTIFACT_BUCKET_SUFFIX,
} as const;

/** Assessment directory name, e.g. `roar-readaloud`. */
export type AssessmentName = keyof typeof ARTIFACT_BUCKET_SUFFIXES;

/**
 * Composes an assessment's artifact bucket name.
 *
 * Takes the assessment rather than a bare suffix: a suffix parameter would let any assessment's
 * suffix be passed on any assessment's upload path and still type-check, routing one assessment's
 * artifacts into another's bucket — exactly the cross-assessment leak per-bucket IAM exists to
 * prevent. Looking the suffix up internally makes that unrepresentable.
 *
 * This is the staging/production derivation. Against the local emulator the admin project has no
 * matching bucket, so emulator resolution is the host's concern rather than this function's — see
 * the dashboard and harness wiring work for how that is handled.
 *
 * The bare name is the form the GCS APIs take — `POST /storage/v1/b` to create one, `/b/<name>/o`
 * to list it — so it is exported alongside the `gs://` form rather than left to callers to derive
 * by stripping a scheme.
 *
 * @param projectId - The admin GCP project ID the host is running against
 * @param assessment - Assessment directory name, e.g. `roar-readaloud`
 * @returns The bucket name, e.g. `<projectId>-readaloud`
 */
export function artifactBucketName(projectId: string, assessment: AssessmentName): string {
  return `${projectId}-${ARTIFACT_BUCKET_SUFFIXES[assessment]}`;
}

/**
 * Composes an assessment's artifact bucket URI.
 *
 * The `gs://` form of {@link artifactBucketName} — for display, logs, and the Pulumi/`gsutil`
 * vocabulary. Anything addressing the bucket over the JSON or media API wants the bare name.
 *
 * @param projectId - The admin GCP project ID the host is running against
 * @param assessment - Assessment directory name, e.g. `roar-readaloud`
 * @returns A `gs://` URI naming that assessment's bucket in that project
 */
export function artifactBucketUri(projectId: string, assessment: AssessmentName): string {
  return `gs://${artifactBucketName(projectId, assessment)}`;
}
