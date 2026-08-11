import { describe, it, expect } from 'vitest';
import { getRegisteredSlugs, getScoringConfig } from './scoring.config-registry';
import { ScoringConfigSchema } from './scoring.config-schema';

import swrConfig from './configs/swr';
import swrEsConfig from './configs/swr-es';
import sreConfig from './configs/sre';
import sreEsConfig from './configs/sre-es';
import paConfig from './configs/pa';
import letterConfig from './configs/letter';
import phonicsConfig from './configs/phonics';
import roamAlpacaConfig from './configs/roam-alpaca';
import fluencyConfig from './configs/fluency';
import morphologyConfig from './configs/morphology';
import cvaConfig from './configs/cva';
import trogConfig from './configs/trog';
import roarInferenceConfig from './configs/roar-inference';
import levanteProvisionalConfig from './configs/levante-provisional';

const ALL_RAW_CONFIGS = [
  { name: 'swr', config: swrConfig },
  { name: 'swr-es', config: swrEsConfig },
  { name: 'sre', config: sreConfig },
  { name: 'sre-es', config: sreEsConfig },
  { name: 'pa', config: paConfig },
  { name: 'letter', config: letterConfig },
  { name: 'phonics', config: phonicsConfig },
  { name: 'roam-alpaca', config: roamAlpacaConfig },
  { name: 'fluency', config: fluencyConfig },
  { name: 'morphology', config: morphologyConfig },
  { name: 'cva', config: cvaConfig },
  { name: 'trog', config: trogConfig },
  { name: 'roar-inference', config: roarInferenceConfig },
  { name: 'levante-provisional', config: levanteProvisionalConfig },
];

describe('scoring config validation', () => {
  it.each(ALL_RAW_CONFIGS)('$name config validates against the Zod schema', ({ config }) => {
    expect(() => ScoringConfigSchema.parse(config)).not.toThrow();
  });

  it('has no duplicate task slugs across config files', () => {
    const allSlugs: string[] = [];
    for (const { config } of ALL_RAW_CONFIGS) {
      const parsed = ScoringConfigSchema.parse(config);
      allSlugs.push(...parsed.taskSlugs);
    }
    const uniqueSlugs = new Set(allSlugs);
    expect(uniqueSlugs.size).toBe(allSlugs.length);
  });

  it('registers all expected task slugs', () => {
    const expected = [
      'swr',
      'swr-es',
      'sre',
      'sre-es',
      'pa',
      'letter',
      'letter-es',
      'letter-en-ca',
      'phonics',
      'roam-alpaca',
      'fluency-arf',
      'fluency-calf',
      'fluency-arf-es',
      'fluency-calf-es',
      'morphology',
      'cva',
      'trog',
      'roar-inference',
      'egma-math',
      'matrix-reasoning',
      'mental-rotation',
      'same-different-selection',
      'theory-of-mind',
    ];
    const registered = getRegisteredSlugs();
    for (const slug of expected) {
      expect(registered).toContain(slug);
    }
  });

  it('returns undefined for unknown task slugs', () => {
    expect(getScoringConfig('unknown-task')).toBeUndefined();
  });

  it('rejects configs with ascending minVersion order', () => {
    const badConfig = {
      taskSlugs: ['test-task'],
      scoreFields: {
        percentile: [
          { minVersion: 0, fieldName: 'field_old' },
          { minVersion: 7, fieldName: 'field_new' },
        ],
      },
      classification: { type: 'none' },
    };
    expect(() => ScoringConfigSchema.parse(badConfig)).toThrow();
  });

  it('accepts single-entry versioned arrays (no ordering issue)', () => {
    const config = {
      taskSlugs: ['test-task'],
      scoreFields: {
        percentile: [{ minVersion: 0, fieldName: 'field' }],
      },
      classification: { type: 'none' },
    };
    expect(() => ScoringConfigSchema.parse(config)).not.toThrow();
  });

  it('percentileBelowGrade defaults to 6 when omitted', () => {
    const config = getScoringConfig('swr');
    expect(config?.classification.type).toBe('percentile-then-rawscore');
    if (config?.classification.type !== 'percentile-then-rawscore') {
      throw new Error('Expected swr to use percentile-then-rawscore classification');
    }
    expect(config.classification.percentileBelowGrade).toBe(6);
  });

  describe('classification types', () => {
    it('swr uses percentile-then-rawscore', () => {
      const config = getScoringConfig('swr');
      expect(config?.classification.type).toBe('percentile-then-rawscore');
    });

    it('phonics uses none', () => {
      const config = getScoringConfig('phonics');
      expect(config?.classification.type).toBe('none');
    });

    it('roam-alpaca uses assessment-computed', () => {
      const config = getScoringConfig('roam-alpaca');
      expect(config?.classification.type).toBe('assessment-computed');
    });

    it('letter uses none', () => {
      const config = getScoringConfig('letter');
      expect(config?.classification.type).toBe('none');
    });

    it('letter-es shares config with letter', () => {
      expect(getScoringConfig('letter-es')).toBe(getScoringConfig('letter'));
    });

    it('letter-en-ca shares config with letter', () => {
      expect(getScoringConfig('letter-en-ca')).toBe(getScoringConfig('letter'));
    });

    it('morphology uses none', () => {
      expect(getScoringConfig('morphology')?.classification.type).toBe('none');
    });

    it('cva uses none', () => {
      expect(getScoringConfig('cva')?.classification.type).toBe('none');
    });
  });
});
