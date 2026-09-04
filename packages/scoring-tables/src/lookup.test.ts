import { describe, it, expect } from 'vitest';
import {
  BLANK_COLUMN_KEYS,
  extractNormedScores,
  resolveNormedScores,
  roundTheta,
  rowMatchesKey,
  selectNormRow,
} from './lookup.js';
import type { KeyingStrategy, LookupRow } from './types.js';

describe('roundTheta', () => {
  it('rounds to a single decimal (the table grid)', () => {
    expect(roundTheta(1.46)).toBe(1.5);
    expect(roundTheta(1.44)).toBe(1.4);
    expect(roundTheta(-3.029)).toBe(-3);
    expect(roundTheta(2)).toBe(2);
  });
});

describe('rowMatchesKey', () => {
  it('compares the key column numerically (string or numeric cells)', () => {
    expect(rowMatchesKey({ ageMonths: 84 }, 'ageMonths', 84)).toBe(true);
    expect(rowMatchesKey({ ageMonths: '84' }, 'ageMonths', 84)).toBe(true);
    expect(rowMatchesKey({ ageMonths: 96 }, 'ageMonths', 84)).toBe(false);
  });
});

describe('selectNormRow', () => {
  const rows: LookupRow[] = [
    { ageMonths: 84, thetaEstimate: 1.4, percentile: 40 },
    { ageMonths: 84, thetaEstimate: 1.5, percentile: 50 },
    { ageMonths: 96, thetaEstimate: 1.5, percentile: 55 },
  ];

  it('matches on key + theta, rounding to the grid', () => {
    const row = selectNormRow(rows, {
      keyColumn: 'ageMonths',
      keyValue: 84,
      scoreColumn: 'thetaEstimate',
      scoreValue: 1.46, // rounds to 1.5
      matchMode: 'theta',
    });
    expect(row?.percentile).toBe(50);
  });

  it('respects the key so the same theta at a different age is not matched', () => {
    const row = selectNormRow(rows, {
      keyColumn: 'ageMonths',
      keyValue: 96,
      scoreColumn: 'thetaEstimate',
      scoreValue: 1.5,
      matchMode: 'theta',
    });
    expect(row?.percentile).toBe(55);
  });

  it('matches on score only when no key column is given (pre-filtered rows)', () => {
    const preFiltered: LookupRow[] = [
      { sreScore: 10, tosrecSS: 90 },
      { sreScore: 11, tosrecSS: 95 },
    ];
    const row = selectNormRow(preFiltered, { scoreColumn: 'sreScore', scoreValue: 11, matchMode: 'exact' });
    expect(row?.tosrecSS).toBe(95);
  });

  it('uses strict equality in exact mode (no rounding)', () => {
    const rawRows: LookupRow[] = [
      { grade: 6, roarScore: 30, percentile: 75 },
      { grade: 6, roarScore: 31, percentile: 78 },
    ];
    expect(
      selectNormRow(rawRows, {
        keyColumn: 'grade',
        keyValue: 6,
        scoreColumn: 'roarScore',
        scoreValue: 30,
        matchMode: 'exact',
      })?.percentile,
    ).toBe(75);
    // 30.4 must NOT match 30 in exact mode
    expect(
      selectNormRow(rawRows, {
        keyColumn: 'grade',
        keyValue: 6,
        scoreColumn: 'roarScore',
        scoreValue: 30.4,
        matchMode: 'exact',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    expect(
      selectNormRow(rows, {
        keyColumn: 'ageMonths',
        keyValue: 84,
        scoreColumn: 'thetaEstimate',
        scoreValue: 9.9,
        matchMode: 'theta',
      }),
    ).toBeUndefined();
  });
});

describe('extractNormedScores', () => {
  it('drops blank/index columns, omitted columns, and null cells; passes the rest through', () => {
    const row: LookupRow = {
      ageMonths: 84,
      thetaEstimate: 1.5,
      percentile: 50,
      standardScore: 100,
      roarScore: 412,
      '': 'junk',
      X: 'junk',
      wjPercentile: null,
    };
    const normed = extractNormedScores(row, { omitColumns: ['ageMonths', 'thetaEstimate'] });
    expect(normed).toEqual({ percentile: 50, standardScore: 100, roarScore: 412 });
  });

  it('passes string percentile sentinels through verbatim', () => {
    const row: LookupRow = { ageMonths: 84, thetaEstimate: 3.2, percentile: '>99', standardScore: 145 };
    const normed = extractNormedScores(row, { omitColumns: ['ageMonths', 'thetaEstimate'] });
    expect(normed).toEqual({ percentile: '>99', standardScore: 145 });
  });

  it('drops the default blank columns even with no omit list', () => {
    expect(BLANK_COLUMN_KEYS).toContain('');
    expect(BLANK_COLUMN_KEYS).toContain('X');
    expect(extractNormedScores({ '': 'a', X: 'b', percentile: 12 })).toEqual({ percentile: 12 });
  });
});

describe('resolveNormedScores — per-assessment keying scenarios', () => {
  it('SWR / Letter / Multichoice: age-months + theta@0.1', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      clamp: { min: 60, max: 96 },
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    const rows: LookupRow[] = [
      { ageMonths: 96, thetaEstimate: 1.5, percentile: 50, standardScore: 100 },
      { ageMonths: 96, thetaEstimate: 1.6, percentile: 54, standardScore: 102 },
    ];
    // age 240 clamps to 96; theta 1.55 rounds to 1.6
    const result = resolveNormedScores({ rows, strategy, demographics: { ageMonths: 240 }, score: 1.55 });
    expect(result).not.toBeNull();
    expect(result!.keyValue).toBe(96);
    expect(result!.normedScores).toEqual({ percentile: 54, standardScore: 102 });
  });

  it('SWR with grade-only participant: derives age then matches', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      clamp: { min: 72, max: 216 },
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    const rows: LookupRow[] = [{ ageMonths: 78, thetaEstimate: -0.5, wjPercentile: 33 }];
    // grade 1 → 78 months
    const result = resolveNormedScores({ rows, strategy, demographics: { grade: 1 }, score: -0.46 });
    expect(result!.keyValue).toBe(78);
    expect(result!.normedScores).toEqual({ wjPercentile: 33 });
  });

  it('PA fixed, grade >= 6: grade key + exact roarScore', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'grade',
      keyColumn: 'grade',
      scoreColumn: 'roarScore',
      matchMode: 'exact',
    };
    const rows: LookupRow[] = [
      { grade: 6, roarScore: 40, percentile: 80, standardScore: 112 },
      { grade: 7, roarScore: 40, percentile: 70, standardScore: 108 },
    ];
    const result = resolveNormedScores({ rows, strategy, demographics: { grade: 6 }, score: 40 });
    expect(result!.normedScores).toEqual({ percentile: 80, standardScore: 112 });
  });

  it('SRE v3: grade key (clamped) + exact sreScore', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'grade',
      keyColumn: 'grade',
      clamp: { min: 1, max: 12 },
      scoreColumn: 'sreScore',
      matchMode: 'exact',
    };
    const rows: LookupRow[] = [
      { grade: 12, sreScore: 55, tosrecSS: 120, tosrecPercentile: 91 },
      { grade: 12, sreScore: 56, tosrecSS: 122, tosrecPercentile: 93 },
    ];
    // grade 13 clamps to 12
    const result = resolveNormedScores({ rows, strategy, demographics: { grade: 13 }, score: 56 });
    expect(result!.keyValue).toBe(12);
    expect(result!.normedScores).toEqual({ tosrecSS: 122, tosrecPercentile: 93 });
  });

  it('foundational composite: age-months + theta@0.1 (the 1917 default)', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      clamp: { min: 72, max: 216 },
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    const rows: LookupRow[] = [
      { ageMonths: 120, thetaEstimate: 0.7, percentile: 62, standardScore: 105, roarScore: 480 },
    ];
    const result = resolveNormedScores({ rows, strategy, demographics: { ageMonths: 120 }, score: 0.68 });
    expect(result!.normedScores).toEqual({ percentile: 62, standardScore: 105, roarScore: 480 });
  });

  it('returns null when the score is non-finite', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    expect(
      resolveNormedScores({
        rows: [{ ageMonths: 84, thetaEstimate: 1 }],
        strategy,
        demographics: { ageMonths: 84 },
        score: Number.NaN,
      }),
    ).toBeNull();
  });

  it('returns null when demographics are unavailable', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    expect(
      resolveNormedScores({ rows: [{ ageMonths: 84, thetaEstimate: 1 }], strategy, demographics: {}, score: 1 }),
    ).toBeNull();
  });

  it('returns null when no row matches the score', () => {
    const strategy: KeyingStrategy = {
      keyKind: 'ageMonths',
      keyColumn: 'ageMonths',
      scoreColumn: 'thetaEstimate',
      matchMode: 'theta',
    };
    expect(
      resolveNormedScores({
        rows: [{ ageMonths: 84, thetaEstimate: 1 }],
        strategy,
        demographics: { ageMonths: 84 },
        score: 5,
      }),
    ).toBeNull();
  });
});
