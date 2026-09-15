import { describe, expect, it } from 'vitest';
import { GCS_ORIGIN, READALOUD_DEVICE_CONFIG_ORIGIN } from './asset-origins';
import { PA_SCORE_TABLE_URL, PA_SCORING_VERSION } from '../roar-pa/config';
import { SWR_SCORE_TABLE_URL, SWR_SCORING_VERSION } from '../roar-swr/config';
import { SRE_SCORE_TABLE_URL, SRE_SCORING_VERSION } from '../roar-sre/config';
import { LETTER_SCORE_TABLE_URL, LETTER_SCORING_VERSION } from '../roar-letter/config';
import { MULTICHOICE_SCORE_TABLE_URL, MULTICHOICE_SCORING_VERSION } from '../roar-multichoice/config';
import {
  LEVANTE_NORMED_TASK_IDS,
  LEVANTE_SCORE_TABLE_URL,
  LEVANTE_SCORING_VERSION,
} from '../roar-levante-tasks/config';
import { FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL } from '../foundational-composite/config';
import { READALOUD_DEVICE_CONFIG_URL, READALOUD_TEST_CONFIG_URL } from '../roar-readaloud/config';
import { ROAV_MP_TASK_ID, ROAV_RVP_TASK_ID, roavAppsBucketUri } from '../roav-apps/config';

/**
 * Behaviour-preservation guard for the asset-origin parameterisation.
 *
 * Every locator in this package gained an optional `origin` argument so a host running its
 * own infrastructure is not bound to ROAR's buckets. The URLs below are pinned **verbatim**
 * to what these builders produced before that change: the whole point is that our own
 * deployments are unaffected, and a silent origin change would send scoring lookups or
 * stimuli to a bucket that has never hosted them.
 */

const CUSTOM_ORIGIN = 'https://assets.example.org';

describe('default asset origins are unchanged', () => {
  it('serves score tables from ROAR GCS buckets', () => {
    expect(PA_SCORE_TABLE_URL(PA_SCORING_VERSION.V5_ADAPTIVE)).toBe(
      'https://storage.googleapis.com/roar-pa/scores/pa_lookup_v5.csv',
    );
    expect(SWR_SCORE_TABLE_URL('swr', SWR_SCORING_VERSION.V7)).toBe(
      'https://storage.googleapis.com/roar-swr/scores/swr_lookup_v7.csv',
    );
    // Task IDs with a hyphen become an underscored filename prefix.
    expect(SWR_SCORE_TABLE_URL('swr-es', SWR_SCORING_VERSION.V7)).toBe(
      'https://storage.googleapis.com/roar-swr/scores/swr_es_lookup_v7.csv',
    );
    expect(SRE_SCORE_TABLE_URL('sre-es', SRE_SCORING_VERSION.V5)).toBe(
      'https://storage.googleapis.com/roar-sre/scores/sre_es_lookup_v5.csv',
    );
    // Letter's bucket is roar-ak, not roar-letter.
    expect(LETTER_SCORE_TABLE_URL(LETTER_SCORING_VERSION.V1)).toBe(
      'https://storage.googleapis.com/roar-ak/scores/letter_lookup_v1.csv',
    );
    // Multichoice shares the roar-survey bucket.
    expect(MULTICHOICE_SCORE_TABLE_URL('cva', MULTICHOICE_SCORING_VERSION.V1)).toBe(
      'https://storage.googleapis.com/roar-survey/scores/cva_lookup_v1.csv',
    );
    // Each LEVANTE normed task has its own bucket and csv prefix.
    expect(LEVANTE_SCORE_TABLE_URL(LEVANTE_NORMED_TASK_IDS.TROG, LEVANTE_SCORING_VERSION.V1)).toBe(
      'https://storage.googleapis.com/roar-syntax/scores/trog_lookup_v1.csv',
    );
    expect(LEVANTE_SCORE_TABLE_URL(LEVANTE_NORMED_TASK_IDS.ROAR_INFERENCE, LEVANTE_SCORING_VERSION.V1)).toBe(
      'https://storage.googleapis.com/roar-inference/scores/inference_lookup_v1.csv',
    );
    // Composite nests scores under a foundational/ prefix.
    expect(FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL(1)).toBe(
      'https://storage.googleapis.com/roar-foundational/foundational/scores/composite_lookup_v1.csv',
    );
  });

  it('serves read-aloud configs from their respective hosts', () => {
    expect(READALOUD_TEST_CONFIG_URL('read-aloud-2025-08-01-A')).toBe(
      'https://storage.googleapis.com/roav-readaloud/en/shared/read-aloud-2025-08-01-A.json',
    );
    // Device configs are on Azure, not GCS — a separate origin on purpose.
    expect(READALOUD_DEVICE_CONFIG_URL('devices_default')).toBe(
      'https://eyetrackingdata.blob.core.windows.net/public/config/devices_default.json',
    );
  });

  it('serves ROAV stimuli from the shared roav-mp bucket', () => {
    expect(roavAppsBucketUri(ROAV_MP_TASK_ID)).toBe('https://storage.googleapis.com/roav-mp');
    expect(roavAppsBucketUri(ROAV_RVP_TASK_ID)).toBe('https://storage.googleapis.com/roav-mp/z_RVP');
  });

  it('exposes the origins it uses, so consumers can derive their own', () => {
    expect(GCS_ORIGIN).toBe('https://storage.googleapis.com');
    expect(READALOUD_DEVICE_CONFIG_ORIGIN).toBe('https://eyetrackingdata.blob.core.windows.net');
  });
});

describe('origins are overridable per call', () => {
  it('redirects score tables while preserving bucket and filename structure', () => {
    expect(PA_SCORE_TABLE_URL(PA_SCORING_VERSION.V5_ADAPTIVE, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-pa/scores/pa_lookup_v5.csv`,
    );
    expect(SWR_SCORE_TABLE_URL('swr', SWR_SCORING_VERSION.V7, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-swr/scores/swr_lookup_v7.csv`,
    );
    expect(SRE_SCORE_TABLE_URL('sre', SRE_SCORING_VERSION.V5, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-sre/scores/sre_lookup_v5.csv`,
    );
    expect(LETTER_SCORE_TABLE_URL(LETTER_SCORING_VERSION.V1, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-ak/scores/letter_lookup_v1.csv`,
    );
    expect(MULTICHOICE_SCORE_TABLE_URL('cva', MULTICHOICE_SCORING_VERSION.V1, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-survey/scores/cva_lookup_v1.csv`,
    );
    expect(LEVANTE_SCORE_TABLE_URL(LEVANTE_NORMED_TASK_IDS.TROG, LEVANTE_SCORING_VERSION.V1, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-syntax/scores/trog_lookup_v1.csv`,
    );
    expect(FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL(1, CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roar-foundational/foundational/scores/composite_lookup_v1.csv`,
    );
  });

  it('redirects read-aloud configs independently of each other', () => {
    expect(READALOUD_TEST_CONFIG_URL('corpus-a', CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/roav-readaloud/en/shared/corpus-a.json`,
    );
    expect(READALOUD_DEVICE_CONFIG_URL('devices_default', CUSTOM_ORIGIN)).toBe(
      `${CUSTOM_ORIGIN}/public/config/devices_default.json`,
    );
  });

  it('redirects ROAV stimuli, keeping per-task subfolders', () => {
    expect(roavAppsBucketUri(ROAV_MP_TASK_ID, CUSTOM_ORIGIN)).toBe(CUSTOM_ORIGIN);
    expect(roavAppsBucketUri(ROAV_RVP_TASK_ID, CUSTOM_ORIGIN)).toBe(`${CUSTOM_ORIGIN}/z_RVP`);
  });
});
