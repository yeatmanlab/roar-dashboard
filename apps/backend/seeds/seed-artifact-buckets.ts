/**
 * Creates the per-assessment artifact buckets in the local GCS stand-in.
 *
 * `fake-gcs-server` does not create buckets on demand — a signed PUT to a bucket
 * that does not exist returns 404 — so dev needs them provisioned up front. In
 * staging and production the equivalent is the Pulumi bucket loop; this is the
 * local counterpart, and both iterate the same suffix list so the two cannot
 * drift.
 *
 * Idempotent: an existing bucket reports 409 and is treated as success, so this
 * can run on every `npm start` without a guard.
 *
 * Environment variables:
 * - GCS_API_ENDPOINT: the GCS stand-in's origin (default: http://localhost:4443, the
 *   platform stack's published port; the assessment stack sets the container-network
 *   address instead)
 * - GCLOUD_PROJECT: project the buckets belong to (default: the emulator project)
 */
import {
  ARTIFACT_BUCKET_SUFFIXES,
  FIREBASE_EMULATOR_PROJECT_ID,
  artifactBucketName,
} from '@roar-platform/assessment-schema';
import type { AssessmentName } from '@roar-platform/assessment-schema';
import { StatusCodes } from 'http-status-codes';

/**
 * Output goes through `console`, not `createChildLogger`, because this script runs
 * inside the assessment stack's migrate container, whose runtime image carries only
 * `apps/backend/src/db` — importing `../src/logger` resolves in the source tree and
 * then fails at runtime with ERR_MODULE_NOT_FOUND. `task-seed.ts`, the only other
 * seed that runs in that container, is on `console` for the same reason.
 */
const LOG_PREFIX = '[dev:seed:buckets]';

/**
 * Provisions one bucket per assessment in the local GCS stand-in.
 *
 * @returns Resolves once every bucket exists.
 * @throws {Error} If a bucket can neither be created nor already exists.
 */
export async function runSeedArtifactBuckets(): Promise<void> {
  const endpoint = process.env.GCS_API_ENDPOINT ?? 'http://localhost:4443';

  const project = process.env.GCLOUD_PROJECT ?? FIREBASE_EMULATOR_PROJECT_ID;
  const assessments = Object.keys(ARTIFACT_BUCKET_SUFFIXES) as AssessmentName[];
  const names = assessments.map((assessment) => artifactBucketName(project, assessment));

  for (const name of names) {
    const response = await fetch(`${endpoint}/storage/v1/b?project=${encodeURIComponent(project)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    // 409 means another run already created it — the whole point of being idempotent.
    if (!response.ok && response.status !== StatusCodes.CONFLICT) {
      throw new Error(`Failed to create bucket ${name}: ${response.status} ${await response.text()}`);
    }
  }

  console.log(`${LOG_PREFIX} Artifact buckets ready: ${names.length} in project ${project}.`);
}

// Allow `tsx seeds/seed-artifact-buckets.ts` as well as import from the pipeline.
if (process.argv[1]?.endsWith('seed-artifact-buckets.ts')) {
  runSeedArtifactBuckets().catch((error: unknown) => {
    console.error(`${LOG_PREFIX} Artifact bucket seeding failed.`, error);
    process.exit(1);
  });
}
