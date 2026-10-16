import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AssessmentName } from './artifact-buckets.js';
import { ARTIFACT_BUCKET_SUFFIXES, artifactBucketName, artifactBucketUri } from './artifact-buckets.js';

/**
 * Invariant guard for the artifact bucket suffixes.
 *
 * Each suffix is declared in its own assessment namespace, which cannot see its siblings — but the
 * names they compose into are globally unique across all of Google Cloud Storage. Two assessments
 * picking the same suffix would silently share one bucket, putting one assessment's student
 * artifacts where the other's scoring principal can read them. That is the failure per-assessment
 * buckets exist to prevent, and nothing else in the package would catch it.
 *
 * The legality and length checks matter for a different reason: because the full name is composed
 * at deploy time, an illegal or over-long fragment surfaces at `pulumi up` rather than here — far
 * from the constant that caused it, and only after someone has waited for a deploy.
 */

/** `packages/assessment-schema/src` -> repo root. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ASSESSMENTS_DIR = join(REPO_ROOT, 'apps', 'assessments');

/** Source-only harness workspace, not an assessment and so not a bucket owner. */
const NON_ASSESSMENT_DIRS = new Set(['shared']);

/**
 * Lowercase alphanumerics in hyphen-separated groups. Narrower than GCS allows — underscores and
 * dots are legal in bucket names but excluded so every composed name is also a valid DNS label.
 */
const SUFFIX_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Google's own limits, redeclared rather than imported so this is an independent oracle. */
const GCS_MAX_BUCKET_NAME_LENGTH = 63;
const GCP_MAX_PROJECT_ID_LENGTH = 30;

/**
 * The assessments themselves, discovered from `apps/assessments/`.
 *
 * Deliberately not the schema namespaces in `src/`: an assessment can exist with its directory
 * landed and its registries not yet updated, and in that state it has no namespace here at all.
 * Discovering from `src/` would make exactly that assessment invisible — the absence this is
 * supposed to catch.
 */
function discoverAssessments(): string[] {
  return readdirSync(ASSESSMENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !NON_ASSESSMENT_DIRS.has(name))
    .sort();
}

describe('artifact bucket suffixes', () => {
  it('declares one suffix per assessment, and no extras', () => {
    expect(Object.keys(ARTIFACT_BUCKET_SUFFIXES).sort()).toEqual(discoverAssessments());
  });

  it('assigns a unique suffix to every assessment', () => {
    const suffixes = Object.values(ARTIFACT_BUCKET_SUFFIXES);
    const duplicates = suffixes.filter((suffix, index) => suffixes.indexOf(suffix) !== index);

    expect(duplicates).toEqual([]);
  });

  it.each(Object.entries(ARTIFACT_BUCKET_SUFFIXES))('%s: %s is a legal GCS name fragment', (_name, suffix) => {
    expect(suffix).toMatch(SUFFIX_PATTERN);
  });

  it.each(Object.keys(ARTIFACT_BUCKET_SUFFIXES) as AssessmentName[])(
    '%s: composes to a legal bucket name against a maximum-length project ID',
    (assessment) => {
      // Asserted on the composed output rather than the raw suffix, because the composed name is
      // what GCS rejects. The worst case is a project ID at GCP's own 30-character ceiling, so
      // passing here means passing for any real project.
      const worstCaseProject = 'p'.repeat(GCP_MAX_PROJECT_ID_LENGTH);

      expect(artifactBucketName(worstCaseProject, assessment).length).toBeLessThanOrEqual(GCS_MAX_BUCKET_NAME_LENGTH);
    },
  );
});

describe('artifactBucketName', () => {
  it('composes a bucket name from the project and the assessment', () => {
    expect(artifactBucketName('example-admin', 'roar-readaloud')).toBe('example-admin-readaloud');
  });

  it('composes the same assessment against a different project', () => {
    // The project is a parameter precisely so one declaration serves every environment; this pins
    // that nothing about the environment leaks into the package.
    expect(artifactBucketName('example-admin-staging', 'roav-ran')).toBe('example-admin-staging-naming');
  });
});

describe('artifactBucketUri', () => {
  it('composes a gs:// URI from the project and the assessment', () => {
    expect(artifactBucketUri('example-admin', 'roar-readaloud')).toBe('gs://example-admin-readaloud');
  });

  it.each(Object.keys(ARTIFACT_BUCKET_SUFFIXES) as AssessmentName[])(
    '%s: is the gs:// form of the same name',
    (assessment) => {
      // The two must not drift: callers pick a form by what they are addressing — the JSON/media
      // API takes the bare name, Pulumi and logs take the URI — and would otherwise reach two
      // different buckets.
      expect(artifactBucketUri('example-admin', assessment)).toBe(
        `gs://${artifactBucketName('example-admin', assessment)}`,
      );
    },
  );
});
