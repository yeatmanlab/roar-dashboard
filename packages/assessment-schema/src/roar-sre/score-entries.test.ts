import { describe, it, expect } from 'vitest';
import { toSreScoreEntries } from './score-entries.js';
import type { SreScoreEntry } from './score-entries.js';
import { SRE_COMPOSITE_SCORE_NAMES, SRE_COMPOSITE_DOMAIN, SRE_PRACTICE_DOMAIN } from './score-names.js';

describe('toSreScoreEntries', () => {
  describe('null / missing input', () => {
    it('returns [] when computed is null', () => {
      expect(toSreScoreEntries(null)).toEqual([]);
    });

    it('returns [] when computed is undefined', () => {
      expect(toSreScoreEntries(undefined)).toEqual([]);
    });

    it('returns [] when computed is an empty object', () => {
      expect(toSreScoreEntries({})).toEqual([]);
    });
  });

  describe('composite domain', () => {
    it('emits sreScore as type=computed', () => {
      const computed = { composite: { sreScore: 10 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual({
        type: 'computed',
        domain: SRE_COMPOSITE_DOMAIN,
        name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE,
        value: '10',
        assessmentStage: 'test',
      });
    });

    it('emits normed scores (percentile, standardScore) as type=computed for v4/v5', () => {
      const computed = { composite: { sreScore: 15, percentile: 72, standardScore: 108 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE, type: 'computed', value: '72' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE, type: 'computed', value: '108' }),
      );
    });

    it('emits legacy TOSREC scores for v3 grade < 6', () => {
      const computed = {
        composite: { sreScore: 12, tosrecPercentile: 65, tosrecSS: 105, scoringVersion: 3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.TOSREC_PERCENTILE, type: 'computed', value: '65' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.TOSREC_SS, type: 'computed', value: '105' }),
      );
    });

    it('emits legacy SPR scores for v3 grade >= 6', () => {
      const computed = {
        composite: { sreScore: 18, sprPercentile: 80, sprStandardScore: 113, scoringVersion: 3 },
      };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SPR_PERCENTILE, type: 'computed', value: '80' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SPR_STANDARD_SCORE, type: 'computed', value: '113' }),
      );
    });

    it('emits scoringVersion as type=computed', () => {
      const computed = { composite: { sreScore: 10, scoringVersion: 5 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(
        expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SCORING_VERSION, type: 'computed', value: '5' }),
      );
    });

    it('skips null values in composite domain', () => {
      const computed = { composite: { sreScore: 10, percentile: null, standardScore: undefined } };
      const entries = toSreScoreEntries(computed);

      expect(entries).not.toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.PERCENTILE }));
      expect(entries).not.toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.STANDARD_SCORE }));
      expect(entries).toContainEqual(expect.objectContaining({ name: SRE_COMPOSITE_SCORE_NAMES.SRE_SCORE }));
    });
  });

  describe('non-composite domains', () => {
    it('emits only sreScore for the practice domain', () => {
      const computed = { practice: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'computed',
        domain: SRE_PRACTICE_DOMAIN,
        name: 'sreScore',
        value: '3',
        assessmentStage: 'practice',
      });
    });

    it('emits only sreScore for the lab domain', () => {
      const computed = { lab: { sreScore: 8 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ domain: 'lab', name: 'sreScore', value: '8', assessmentStage: 'test' });
    });

    it('emits only sreScore for the ai domain', () => {
      const computed = { ai: { sreScore: 6 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ domain: 'ai', name: 'sreScore', value: '6', assessmentStage: 'test' });
    });

    it('skips non-composite domain when sreScore is null', () => {
      const computed = { lab: { sreScore: null } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toHaveLength(0);
    });
  });

  describe('assessmentStage', () => {
    it('assigns practice stage to the practice domain', () => {
      const computed = { practice: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('practice');
    });

    it('assigns test stage to the composite domain', () => {
      const computed = { composite: { sreScore: 10 } };
      const entries = toSreScoreEntries(computed);

      expect(entries[0]!.assessmentStage).toBe('test');
    });

    it('assigns test stage to all non-practice, non-composite domains', () => {
      const computed = { lab: { sreScore: 8 }, ai: { sreScore: 5 } };
      const entries = toSreScoreEntries(computed);

      for (const entry of entries) {
        expect(entry.assessmentStage).toBe('test');
      }
    });
  });

  describe('all domains emitted together', () => {
    it('emits entries for all domains present in computed (practice + composite + lab)', () => {
      const computed = {
        practice: { sreScore: 3 },
        lab: { sreScore: 12 },
        composite: { sreScore: 12, percentile: 75, standardScore: 110, scoringVersion: 5 },
      };
      const entries = toSreScoreEntries(computed);

      // practice: 1 entry (sreScore)
      // lab: 1 entry (sreScore)
      // composite: 4 entries (sreScore, percentile, standardScore, scoringVersion)
      expect(entries).toHaveLength(6);

      expect(entries.filter((e: SreScoreEntry) => e.domain === 'practice')).toHaveLength(1);
      expect(entries.filter((e: SreScoreEntry) => e.domain === 'lab')).toHaveLength(1);
      expect(entries.filter((e: SreScoreEntry) => e.domain === 'composite')).toHaveLength(4);
    });
  });

  describe('value serialization', () => {
    it('converts numeric values to strings', () => {
      const computed = { composite: { sreScore: 10.5 }, practice: { sreScore: 3 } };
      const entries = toSreScoreEntries(computed);

      expect(entries).toContainEqual(expect.objectContaining({ name: 'sreScore', domain: 'composite', value: '10.5' }));
      expect(entries).toContainEqual(expect.objectContaining({ name: 'sreScore', domain: 'practice', value: '3' }));
    });
  });

  describe('strict mode', () => {
    it('does not throw on recognized composite score names in strict mode', () => {
      const computed = { composite: { sreScore: 10, percentile: 75 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('throws on unrecognized composite score name in strict mode', () => {
      const computed = { composite: { sreScore: 10, unknownScore: 99 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).toThrow(/unknownScore/);
    });

    it('does not throw on unrecognized composite score name in non-strict mode', () => {
      const computed = { composite: { sreScore: 10, unknownScore: 99 } };
      expect(() => toSreScoreEntries(computed, { strict: false })).not.toThrow();
    });

    it('does not throw on unrecognized non-composite domains in strict mode', () => {
      // Strict only checks composite field names, not domain keys
      const computed = { newDomain: { sreScore: 5 }, composite: { sreScore: 10 } };
      expect(() => toSreScoreEntries(computed, { strict: true })).not.toThrow();
    });
  });

  describe('full normed output (English v5)', () => {
    it('maps complete scoring output for a v5 English variant', () => {
      const computed = {
        practice: { sreScore: 3 },
        lab: { sreScore: 12 },
        ai: { sreScore: 10 },
        composite: {
          sreScore: 12,
          percentile: 78,
          standardScore: 112,
          scoringVersion: 5,
        },
      };
      const entries = toSreScoreEntries(computed);

      // practice: 1, lab: 1, ai: 1, composite: 4 = 7
      expect(entries).toHaveLength(7);

      const compositeEntries = entries.filter((e: SreScoreEntry) => e.domain === 'composite');
      expect(compositeEntries).toHaveLength(4);
      for (const entry of compositeEntries) {
        expect(entry.type).toBe('computed');
        expect(entry.assessmentStage).toBe('test');
      }

      const practiceEntry = entries.find((e: SreScoreEntry) => e.domain === 'practice');
      expect(practiceEntry).toMatchObject({ assessmentStage: 'practice', type: 'computed', value: '3' });
    });
  });
});
