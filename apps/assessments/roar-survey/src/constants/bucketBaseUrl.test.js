import { describe, expect, it } from 'vitest';
import { getBucketUrl } from './bucketBaseUrl';

/**
 * The single place roar-survey's real content origin is pinned.
 *
 * SurveyRunner stubs this helper so its own suite stays free of infrastructure URLs, which
 * leaves exactly one test standing between a silent bucket rename and surveys fetching from
 * somewhere that has never hosted them. Mirrors
 * `packages/assessment-schema/src/constants/asset-origins.test.ts`.
 *
 * The origin below is written out rather than imported from `bucketBaseUrl.js` **on purpose**.
 * Deriving it from the module under test would assert only that a template string concatenates,
 * and a rename would sail through — which is the one failure this file exists to catch. It is
 * declared once here so the locale cases can share it without restating the bucket three times.
 */
const SURVEY_CONTENT_ORIGIN = 'https://storage.googleapis.com/roar-survey-app';

describe('survey content origin', () => {
  it('serves survey content from the ROAR GCS bucket, per locale', () => {
    expect(getBucketUrl('en')).toBe(`${SURVEY_CONTENT_ORIGIN}/en/`);
    expect(getBucketUrl('es')).toBe(`${SURVEY_CONTENT_ORIGIN}/es/`);
  });

  it('defaults to English when no locale is given', () => {
    expect(getBucketUrl()).toBe(`${SURVEY_CONTENT_ORIGIN}/en/`);
  });
});
