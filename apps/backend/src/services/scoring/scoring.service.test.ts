import { describe, it, expect } from 'vitest';
import { getSupportLevel } from './scoring.service';
import { getRawScoreThreshold, resolveScoreFieldNames } from './scoring.constants';

describe('getSupportLevel', () => {
  describe('raw-score-only tasks', () => {
    it('returns null for phonics', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'phonics', scoringVersion: null }),
      ).toBeNull();
    });

    it('returns null for roam-alpaca', () => {
      expect(
        getSupportLevel({ grade: '3', percentile: 80, rawScore: 100, taskSlug: 'roam-alpaca', scoringVersion: null }),
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
  it('resolves swr fields', () => {
    const result = resolveScoreFieldNames('swr', 3);
    expect(result.percentileFieldNames).toContain('percentile');
    expect(result.percentileFieldNames).toContain('wjPercentile');
    expect(result.rawScoreFieldNames).toContain('roarScore');
  });

  it('resolves sre fields for grade < 6', () => {
    const result = resolveScoreFieldNames('sre', 3);
    expect(result.percentileFieldNames).toContain('percentile');
    expect(result.percentileFieldNames).toContain('tosrecPercentile');
    expect(result.rawScoreFieldNames).toContain('sreScore');
  });

  it('resolves sre fields for grade >= 6', () => {
    const result = resolveScoreFieldNames('sre', 8);
    expect(result.percentileFieldNames).toContain('percentile');
    expect(result.percentileFieldNames).toContain('sprPercentile');
    expect(result.rawScoreFieldNames).toContain('sreScore');
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
    // null grade treated as >= 6 path
    expect(result.percentileFieldNames).toContain('sprPercentile');
  });
});
