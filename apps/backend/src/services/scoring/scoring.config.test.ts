import { describe, it, expect } from 'vitest';
import { getRegisteredSlugs, getScoringConfig } from './scoring.config-registry';
import { ScoringConfigSchema } from './scoring.config-schema';

import swrConfig from './configs/swr.json';
import swrEsConfig from './configs/swr-es.json';
import sreConfig from './configs/sre.json';
import sreEsConfig from './configs/sre-es.json';
import paConfig from './configs/pa.json';
import letterConfig from './configs/letter.json';
import phonicsConfig from './configs/phonics.json';
import roamAlpacaConfig from './configs/roam-alpaca.json';

const ALL_RAW_CONFIGS = [
  { name: 'swr', config: swrConfig },
  { name: 'swr-es', config: swrEsConfig },
  { name: 'sre', config: sreConfig },
  { name: 'sre-es', config: sreEsConfig },
  { name: 'pa', config: paConfig },
  { name: 'letter', config: letterConfig },
  { name: 'phonics', config: phonicsConfig },
  { name: 'roam-alpaca', config: roamAlpacaConfig },
];

describe('scoring config validation', () => {
  it.each(ALL_RAW_CONFIGS)('$name.json validates against the Zod schema', ({ config }) => {
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
    ];
    const registered = getRegisteredSlugs();
    for (const slug of expected) {
      expect(registered).toContain(slug);
    }
  });

  it('returns undefined for unknown task slugs', () => {
    expect(getScoringConfig('unknown-task')).toBeUndefined();
    expect(getScoringConfig('morphology')).toBeUndefined();
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

  it('percentileMaxGrade defaults to 6 when omitted', () => {
    const config = getScoringConfig('swr');
    expect(config?.classification.type).toBe('percentile-then-rawscore');
    if (config?.classification.type === 'percentile-then-rawscore') {
      expect(config.classification.percentileMaxGrade).toBe(6);
    }
  });

  describe('classification types', () => {
    it('swr uses percentile-then-rawscore', () => {
      const config = getScoringConfig('swr');
      expect(config?.classification.type).toBe('percentile-then-rawscore');
    });

    it('phonics uses rawscore-only', () => {
      const config = getScoringConfig('phonics');
      expect(config?.classification.type).toBe('rawscore-only');
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
  });
});
