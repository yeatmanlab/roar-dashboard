import { describe, it, expect } from 'vitest';
import {
  parseScoreValue,
  getSupportLevel,
  getRawScoreThreshold,
  resolveScoreFieldNames,
  resolveScoreFieldName,
  getSupportLevelFieldName,
} from './scoring.service';

describe('parseScoreValue', () => {
  it('returns null for null', () => {
    expect(parseScoreValue(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseScoreValue(undefined)).toBeNull();
  });

  it('returns the number for numeric input', () => {
    expect(parseScoreValue(42)).toBe(42);
    expect(parseScoreValue(0)).toBe(0);
    expect(parseScoreValue(99.5)).toBe(99.5);
  });

  it('returns null for NaN numeric input', () => {
    expect(parseScoreValue(NaN)).toBeNull();
  });

  it('strips ">" and parses the number', () => {
    expect(parseScoreValue('>99')).toBe(99);
  });

  it('strips "<" and parses the number', () => {
    expect(parseScoreValue('<1')).toBe(1);
  });

  it('parses plain numeric strings', () => {
    expect(parseScoreValue('42')).toBe(42);
    expect(parseScoreValue('99.5')).toBe(99.5);
  });

  it('returns null for non-numeric strings', () => {
    expect(parseScoreValue('abc')).toBeNull();
    expect(parseScoreValue('')).toBeNull();
  });
});

describe('getSupportLevel', () => {
  describe('raw-score-only tasks', () => {
    it('returns null for phonics', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'phonics', scoringVersion: null }),
      ).toBeNull();
    });
  });

  describe('assessment-computed tasks', () => {
    it('returns validated support level for roam-alpaca', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: null,
          rawScore: null,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
          assessmentSupportLevel: 'achievedSkill',
        }),
      ).toBe('achievedSkill');
    });

    it('returns developingSkill for roam-alpaca', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: null,
          rawScore: null,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
          assessmentSupportLevel: 'developingSkill',
        }),
      ).toBe('developingSkill');
    });

    it('returns needsExtraSupport for roam-alpaca', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: null,
          rawScore: null,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
          assessmentSupportLevel: 'needsExtraSupport',
        }),
      ).toBe('needsExtraSupport');
    });

    it('returns null for roam-alpaca with no assessmentSupportLevel', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: 80,
          rawScore: 100,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
        }),
      ).toBeNull();
    });

    it('returns null for roam-alpaca with invalid assessmentSupportLevel', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: null,
          rawScore: null,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
          assessmentSupportLevel: 'invalidLevel',
        }),
      ).toBeNull();
    });

    it('returns null for roam-alpaca with null assessmentSupportLevel', () => {
      expect(
        getSupportLevel({
          grade: '3',
          percentile: null,
          rawScore: null,
          taskSlug: 'roam-alpaca',
          scoringVersion: null,
          assessmentSupportLevel: null,
        }),
      ).toBeNull();
    });
  });

  describe('no score data', () => {
    it('returns null when both percentile and rawScore are null', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: null, rawScore: null, taskSlug: 'swr', scoringVersion: null }),
      ).toBeNull();
    });
  });

  describe('percentile-based classification (grades < 6, legacy norms)', () => {
    const base = { taskSlug: 'swr', scoringVersion: null as number | null };

    it('achievedSkill when percentile >= 50', () => {
      expect(getSupportLevel({ ...base, grade: '3', percentile: 50, rawScore: 600 })).toBe('achievedSkill');
      expect(getSupportLevel({ ...base, grade: '3', percentile: 75, rawScore: 600 })).toBe('achievedSkill');
    });

    it('developingSkill when percentile > 25 and < 50', () => {
      expect(getSupportLevel({ ...base, grade: '3', percentile: 30, rawScore: 450 })).toBe('developingSkill');
      expect(getSupportLevel({ ...base, grade: '3', percentile: 49, rawScore: 450 })).toBe('developingSkill');
    });

    it('needsExtraSupport when percentile <= 25', () => {
      expect(getSupportLevel({ ...base, grade: '3', percentile: 25, rawScore: 350 })).toBe('needsExtraSupport');
      expect(getSupportLevel({ ...base, grade: '3', percentile: 10, rawScore: 350 })).toBe('needsExtraSupport');
    });

    it('handles Kindergarten as grade < 6', () => {
      expect(getSupportLevel({ ...base, grade: 'Kindergarten', percentile: 60, rawScore: 600 })).toBe('achievedSkill');
    });

    it('handles grade 5 (boundary)', () => {
      expect(getSupportLevel({ ...base, grade: '5', percentile: 60, rawScore: 600 })).toBe('achievedSkill');
    });
  });

  describe('percentile-based classification (grades < 6, updated norms)', () => {
    it('swr with scoringVersion >= 7 uses [40, 20] cutoffs', () => {
      expect(getSupportLevel({ grade: '3', percentile: 40, rawScore: 500, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'achievedSkill',
      );
      expect(getSupportLevel({ grade: '3', percentile: 39, rawScore: 500, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'developingSkill',
      );
      expect(getSupportLevel({ grade: '3', percentile: 20, rawScore: 500, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'needsExtraSupport',
      );
    });

    it('swr with scoringVersion < 7 uses legacy [50, 25] cutoffs', () => {
      expect(getSupportLevel({ grade: '3', percentile: 49, rawScore: 500, taskSlug: 'swr', scoringVersion: 6 })).toBe(
        'developingSkill',
      );
      expect(getSupportLevel({ grade: '3', percentile: 50, rawScore: 500, taskSlug: 'swr', scoringVersion: 6 })).toBe(
        'achievedSkill',
      );
    });

    it('sre with scoringVersion >= 4 uses updated cutoffs', () => {
      expect(getSupportLevel({ grade: '3', percentile: 40, rawScore: 50, taskSlug: 'sre', scoringVersion: 4 })).toBe(
        'achievedSkill',
      );
      expect(getSupportLevel({ grade: '3', percentile: 21, rawScore: 50, taskSlug: 'sre', scoringVersion: 4 })).toBe(
        'developingSkill',
      );
    });

    it('swr-es with scoringVersion >= 1 uses updated cutoffs', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 40, rawScore: 500, taskSlug: 'swr-es', scoringVersion: 1 }),
      ).toBe('achievedSkill');
    });

    it('sre-es with scoringVersion >= 1 uses updated cutoffs', () => {
      expect(getSupportLevel({ grade: '3', percentile: 40, rawScore: 20, taskSlug: 'sre-es', scoringVersion: 1 })).toBe(
        'achievedSkill',
      );
    });
  });

  describe('raw score classification (grades >= 6)', () => {
    it('swr legacy: above=550, some=400', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 550, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('achievedSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 450, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('developingSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 400, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('needsExtraSupport');
    });

    it('swr updated (v>=7): above=513, some=413', () => {
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 513, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'achievedSkill',
      );
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 450, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'developingSkill',
      );
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 413, taskSlug: 'swr', scoringVersion: 7 })).toBe(
        'needsExtraSupport',
      );
    });

    it('sre legacy: above=70, some=47', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 70, taskSlug: 'sre', scoringVersion: null }),
      ).toBe('achievedSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 50, taskSlug: 'sre', scoringVersion: null }),
      ).toBe('developingSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 47, taskSlug: 'sre', scoringVersion: null }),
      ).toBe('needsExtraSupport');
    });

    it('sre updated (v>=4): above=41, some=23', () => {
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 41, taskSlug: 'sre', scoringVersion: 4 })).toBe(
        'achievedSkill',
      );
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 30, taskSlug: 'sre', scoringVersion: 4 })).toBe(
        'developingSkill',
      );
      expect(getSupportLevel({ grade: '8', percentile: null, rawScore: 23, taskSlug: 'sre', scoringVersion: 4 })).toBe(
        'needsExtraSupport',
      );
    });

    it('pa: above=55, some=45 (no version dependency)', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 55, taskSlug: 'pa', scoringVersion: null }),
      ).toBe('achievedSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 50, taskSlug: 'pa', scoringVersion: null }),
      ).toBe('developingSkill');
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 45, taskSlug: 'pa', scoringVersion: null }),
      ).toBe('needsExtraSupport');
    });

    it('returns null for unknown task with no thresholds', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 100, taskSlug: 'morphology', scoringVersion: null }),
      ).toBeNull();
    });
  });

  describe('raw score fallback (grades < 6, no percentile)', () => {
    it('falls back to raw score when percentile is null', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: null, rawScore: 550, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('achievedSkill');
    });
  });

  describe('grade edge cases', () => {
    it('grade 6 uses raw score thresholds (not percentile)', () => {
      // Even with a percentile, grade 6 should use raw score
      expect(
        getSupportLevel({ grade: '6', percentile: 80, rawScore: 550, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('achievedSkill');
      expect(
        getSupportLevel({ grade: '6', percentile: 80, rawScore: 350, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('needsExtraSupport');
    });

    it('null grade with percentile uses raw score (gradeLevel is null, not < 6)', () => {
      // gradeLevel is null, so the percentile path is skipped, falls to raw score
      expect(
        getSupportLevel({ grade: null, percentile: 80, rawScore: 550, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('achievedSkill');
    });

    it('Ungraded uses raw score thresholds', () => {
      expect(
        getSupportLevel({ grade: 'Ungraded', percentile: null, rawScore: 550, taskSlug: 'swr', scoringVersion: null }),
      ).toBe('achievedSkill');
    });
  });

  describe('swr-es and sre-es version edge cases', () => {
    it('swr-es without scoringVersion returns null for raw score (no legacy thresholds)', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 500, taskSlug: 'swr-es', scoringVersion: null }),
      ).toBeNull();
    });

    it('sre-es without scoringVersion returns null for raw score (no legacy thresholds)', () => {
      expect(
        getSupportLevel({ grade: '8', percentile: null, rawScore: 20, taskSlug: 'sre-es', scoringVersion: null }),
      ).toBeNull();
    });
  });

  describe('non-classifiable tasks', () => {
    it('letter returns null', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'letter', scoringVersion: null }),
      ).toBeNull();
    });

    it('letter-es returns null', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'letter-es', scoringVersion: null }),
      ).toBeNull();
    });

    it('letter-en-ca returns null', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'letter-en-ca', scoringVersion: null }),
      ).toBeNull();
    });
  });
});

describe('getRawScoreThreshold', () => {
  it('returns swr legacy thresholds', () => {
    expect(getRawScoreThreshold('swr', null)).toEqual({ above: 550, some: 400 });
    expect(getRawScoreThreshold('swr', 6)).toEqual({ above: 550, some: 400 });
  });

  it('returns swr updated thresholds', () => {
    expect(getRawScoreThreshold('swr', 7)).toEqual({ above: 513, some: 413 });
  });

  it('returns swr-es thresholds only for v >= 1', () => {
    expect(getRawScoreThreshold('swr-es', 1)).toEqual({ above: 547, some: 447 });
    expect(getRawScoreThreshold('swr-es', null)).toBeNull();
    expect(getRawScoreThreshold('swr-es', 0)).toBeNull();
  });

  it('returns sre legacy thresholds', () => {
    expect(getRawScoreThreshold('sre', null)).toEqual({ above: 70, some: 47 });
  });

  it('returns sre updated thresholds', () => {
    expect(getRawScoreThreshold('sre', 4)).toEqual({ above: 41, some: 23 });
  });

  it('returns sre-es thresholds only for v >= 1', () => {
    expect(getRawScoreThreshold('sre-es', 1)).toEqual({ above: 25, some: 12 });
    expect(getRawScoreThreshold('sre-es', null)).toBeNull();
  });

  it('returns pa thresholds (version-independent)', () => {
    expect(getRawScoreThreshold('pa', null)).toEqual({ above: 55, some: 45 });
    expect(getRawScoreThreshold('pa', 99)).toEqual({ above: 55, some: 45 });
  });

  it('returns null for unknown tasks', () => {
    expect(getRawScoreThreshold('letter', null)).toBeNull();
    expect(getRawScoreThreshold('morphology', null)).toBeNull();
    expect(getRawScoreThreshold('unknown-task', null)).toBeNull();
  });
});

describe('resolveScoreFieldNames', () => {
  describe('without scoringVersion (all possible names)', () => {
    it('resolves swr fields (all versions)', () => {
      const result = resolveScoreFieldNames('swr', 3);
      expect(result.percentileFieldNames).toContain('percentile');
      expect(result.percentileFieldNames).toContain('wjPercentile');
      expect(result.rawScoreFieldNames).toContain('roarScore');
    });

    it('resolves sre fields for grade < 6 (all versions)', () => {
      const result = resolveScoreFieldNames('sre', 3);
      expect(result.percentileFieldNames).toContain('percentile');
      expect(result.percentileFieldNames).toContain('tosrecPercentile');
      expect(result.rawScoreFieldNames).toContain('sreScore');
    });

    it('resolves sre fields for grade >= 6 (all versions)', () => {
      const result = resolveScoreFieldNames('sre', 8);
      expect(result.percentileFieldNames).toContain('percentile');
      expect(result.percentileFieldNames).toContain('sprPercentile');
      expect(result.rawScoreFieldNames).toContain('sreScore');
    });
  });

  describe('with scoringVersion (version-specific names only)', () => {
    it('swr v3 returns only legacy "wjPercentile" (not "percentile")', () => {
      const result = resolveScoreFieldNames('swr', 3, 3);
      expect(result.percentileFieldNames).toEqual(['wjPercentile']);
      expect(result.rawScoreFieldNames).toEqual(['roarScore']);
    });

    it('swr v7 returns only updated "percentile"', () => {
      const result = resolveScoreFieldNames('swr', 3, 7);
      expect(result.percentileFieldNames).toEqual(['percentile']);
      expect(result.rawScoreFieldNames).toEqual(['roarScore']);
    });

    it('swr null version resolves as v0 (legacy)', () => {
      const result = resolveScoreFieldNames('swr', 3, null);
      expect(result.percentileFieldNames).toEqual(['wjPercentile']);
    });

    it('sre v3 grade < 6 returns "tosrecPercentile"', () => {
      const result = resolveScoreFieldNames('sre', 3, 3);
      expect(result.percentileFieldNames).toEqual(['tosrecPercentile']);
    });

    it('sre v4 returns "percentile" regardless of grade', () => {
      expect(resolveScoreFieldNames('sre', 3, 4).percentileFieldNames).toEqual(['percentile']);
      expect(resolveScoreFieldNames('sre', 8, 4).percentileFieldNames).toEqual(['percentile']);
    });

    it('sre v3 grade >= 6 returns "sprPercentile"', () => {
      const result = resolveScoreFieldNames('sre', 8, 3);
      expect(result.percentileFieldNames).toEqual(['sprPercentile']);
    });
  });

  it('resolves pa fields for grade < 6', () => {
    const result = resolveScoreFieldNames('pa', 3);
    expect(result.percentileFieldNames).toContain('percentile');
    expect(result.rawScoreFieldNames).toContain('roarScore');
  });

  it('resolves pa fields for grade >= 6', () => {
    const result = resolveScoreFieldNames('pa', 8);
    expect(result.percentileFieldNames).toContain('sprPercentile');
    expect(result.rawScoreFieldNames).toContain('roarScore');
  });

  it('resolves letter fields', () => {
    const result = resolveScoreFieldNames('letter', 1);
    expect(result.percentileFieldNames).toContain('totalPercentCorrect');
    expect(result.rawScoreFieldNames).toContain('totalCorrect');
  });

  it('resolves phonics fields', () => {
    const result = resolveScoreFieldNames('phonics', 3);
    expect(result.percentileFieldNames).toContain('totalPercentCorrect');
    expect(result.rawScoreFieldNames).toContain('totalCorrect');
  });

  it('resolves sre-es fields', () => {
    const result = resolveScoreFieldNames('sre-es', 3);
    expect(result.percentileFieldNames).toContain('percentile');
    expect(result.rawScoreFieldNames).toContain('sreScore');
  });

  it('returns empty arrays for unknown task', () => {
    const result = resolveScoreFieldNames('unknown-task', 3);
    expect(result.percentileFieldNames).toHaveLength(0);
    expect(result.rawScoreFieldNames).toHaveLength(0);
  });

  it('handles null grade level', () => {
    const result = resolveScoreFieldNames('sre', null);
    // null grade treated as >= 6 path (default in grade-conditional)
    expect(result.percentileFieldNames).toContain('sprPercentile');
  });
});

describe('resolveScoreFieldName', () => {
  describe('swr (simple versioned fields)', () => {
    it('returns "percentile" for v >= 7', () => {
      expect(resolveScoreFieldName('swr', 3, 'percentile', 7)).toBe('percentile');
    });

    it('returns "wjPercentile" for legacy version', () => {
      expect(resolveScoreFieldName('swr', 3, 'percentile', null)).toBe('wjPercentile');
      expect(resolveScoreFieldName('swr', 3, 'percentile', 6)).toBe('wjPercentile');
    });

    it('returns "roarScore" for rawScore (all versions)', () => {
      expect(resolveScoreFieldName('swr', 3, 'rawScore', null)).toBe('roarScore');
      expect(resolveScoreFieldName('swr', 3, 'rawScore', 7)).toBe('roarScore');
    });

    it('returns "standardScore" for standardScore (all versions)', () => {
      expect(resolveScoreFieldName('swr', 3, 'standardScore', null)).toBe('standardScore');
    });
  });

  describe('pa (grade-conditional fields)', () => {
    it('returns "percentile" for grade < 6', () => {
      expect(resolveScoreFieldName('pa', 3, 'percentile', null)).toBe('percentile');
    });

    it('returns "sprPercentile" for grade >= 6', () => {
      expect(resolveScoreFieldName('pa', 8, 'percentile', null)).toBe('sprPercentile');
    });

    it('returns "sprPercentileString" for percentileDisplay grade >= 6', () => {
      expect(resolveScoreFieldName('pa', 8, 'percentileDisplay', null)).toBe('sprPercentileString');
    });

    it('returns "sprStandardScore" for standardScore grade >= 6', () => {
      expect(resolveScoreFieldName('pa', 8, 'standardScore', null)).toBe('sprStandardScore');
    });

    it('returns "sprStandardScoreString" for standardScoreDisplay grade >= 6', () => {
      expect(resolveScoreFieldName('pa', 8, 'standardScoreDisplay', null)).toBe('sprStandardScoreString');
    });

    it('uses default for null gradeLevel', () => {
      expect(resolveScoreFieldName('pa', null, 'percentile', null)).toBe('sprPercentile');
    });
  });

  describe('sre (versioned + grade-conditional)', () => {
    it('returns "percentile" for v >= 4 regardless of grade', () => {
      expect(resolveScoreFieldName('sre', 3, 'percentile', 4)).toBe('percentile');
      expect(resolveScoreFieldName('sre', 8, 'percentile', 4)).toBe('percentile');
    });

    it('returns "tosrecPercentile" for legacy grade < 6', () => {
      expect(resolveScoreFieldName('sre', 3, 'percentile', null)).toBe('tosrecPercentile');
    });

    it('returns "sprPercentile" for legacy grade >= 6', () => {
      expect(resolveScoreFieldName('sre', 8, 'percentile', null)).toBe('sprPercentile');
    });

    it('returns "tosrecSS" for legacy standardScore grade < 6', () => {
      expect(resolveScoreFieldName('sre', 3, 'standardScore', null)).toBe('tosrecSS');
    });

    it('returns "sprStandardScore" for legacy standardScore grade >= 6', () => {
      expect(resolveScoreFieldName('sre', 8, 'standardScore', null)).toBe('sprStandardScore');
    });
  });

  describe('letter (null fields)', () => {
    it('returns null for standardScore', () => {
      expect(resolveScoreFieldName('letter', 3, 'standardScore', null)).toBeNull();
    });

    it('returns "totalPercentCorrect" for percentile', () => {
      expect(resolveScoreFieldName('letter', 3, 'percentile', null)).toBe('totalPercentCorrect');
    });
  });

  describe('unknown task', () => {
    it('returns null for all field types', () => {
      expect(resolveScoreFieldName('unknown-task', 3, 'percentile', null)).toBeNull();
      expect(resolveScoreFieldName('unknown-task', 3, 'rawScore', null)).toBeNull();
    });
  });
});

describe('getSupportLevelFieldName', () => {
  it('returns "supportLevel" for roam-alpaca', () => {
    expect(getSupportLevelFieldName('roam-alpaca')).toBe('supportLevel');
  });

  it('returns null for percentile-then-rawscore tasks', () => {
    expect(getSupportLevelFieldName('swr')).toBeNull();
    expect(getSupportLevelFieldName('sre')).toBeNull();
    expect(getSupportLevelFieldName('pa')).toBeNull();
  });

  it('returns null for rawscore-only tasks', () => {
    expect(getSupportLevelFieldName('phonics')).toBeNull();
  });

  it('returns null for none classification tasks', () => {
    expect(getSupportLevelFieldName('letter')).toBeNull();
  });

  it('returns null for unknown tasks', () => {
    expect(getSupportLevelFieldName('unknown-task')).toBeNull();
  });
});
