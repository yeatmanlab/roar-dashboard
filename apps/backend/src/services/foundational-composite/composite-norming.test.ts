import { describe, it, expect } from 'vitest';
import type { LookupRow } from '@roar-platform/scoring-tables';
import { buildCompositeNormScoreRows, resolveCompositeDemographics } from './composite-norming';
import { FOUNDATIONAL_COMPOSITE_KEYING } from '../../constants/foundational-composite';
import { SCORE_DOMAIN, SCORE_NAME, SCORE_TYPE } from '../../constants/run-scores';

describe('resolveCompositeDemographics', () => {
  // The reference date is the "date of the latest assessment"; age is computed as of it.
  const REFERENCE_DATE = new Date(Date.UTC(2026, 5, 20)); // 2026-06-20

  it('computes age-in-months as of the reference date and maps the grade enum to a number', () => {
    const demo = resolveCompositeDemographics({ dob: '2016-06-20', grade: '3' }, REFERENCE_DATE);
    expect(demo.grade).toBe(3);
    expect(demo.ageMonths).toBe(120); // exactly 10 years on 2026-06-20
  });

  it('maps Kindergarten to grade 0', () => {
    expect(resolveCompositeDemographics({ dob: null, grade: 'Kindergarten' }, REFERENCE_DATE).grade).toBe(0);
  });

  it('yields null demographics for missing/ungraded inputs', () => {
    expect(resolveCompositeDemographics({ dob: null, grade: null }, REFERENCE_DATE)).toEqual({
      ageMonths: null,
      grade: null,
    });
    expect(resolveCompositeDemographics({ dob: null, grade: 'Ungraded' }, REFERENCE_DATE)).toEqual({
      ageMonths: null,
      grade: null,
    });
  });
});

describe('buildCompositeNormScoreRows', () => {
  const runId = 'run-1';
  const tableRows: LookupRow[] = [
    { ageMonths: 120, thetaEstimate: 0.7, percentile: 62, standardScore: 105, roarScore: 480 },
    { ageMonths: 120, thetaEstimate: 0.8, percentile: 66, standardScore: 107 },
  ];

  it('builds a (computed, composite_foundational, <name>) row per recognized normed column', () => {
    const rows = buildCompositeNormScoreRows({
      runId,
      composite: 0.68, // rounds to 0.7 on the grid
      demographics: { ageMonths: 120, grade: 4 },
      tableRows,
      keying: FOUNDATIONAL_COMPOSITE_KEYING,
    });
    expect(rows).toEqual([
      {
        runId,
        type: SCORE_TYPE.COMPUTED,
        domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
        name: SCORE_NAME.PERCENTILE,
        value: '62',
        assessmentStage: null,
        categoryScore: null,
      },
      {
        runId,
        type: SCORE_TYPE.COMPUTED,
        domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
        name: SCORE_NAME.STANDARD_SCORE,
        value: '105',
        assessmentStage: null,
        categoryScore: null,
      },
      {
        runId,
        type: SCORE_TYPE.COMPUTED,
        domain: SCORE_DOMAIN.COMPOSITE_FOUNDATIONAL,
        name: SCORE_NAME.ROAR_SCORE,
        value: '480',
        assessmentStage: null,
        categoryScore: null,
      },
    ]);
  });

  it('omits normed columns the matched row does not provide', () => {
    // The 0.8 row has percentile + standardScore but no roarScore.
    const rows = buildCompositeNormScoreRows({
      runId,
      composite: 0.8,
      demographics: { ageMonths: 120, grade: 4 },
      tableRows,
      keying: FOUNDATIONAL_COMPOSITE_KEYING,
    });
    expect(rows.map((r) => r.name)).toEqual([SCORE_NAME.PERCENTILE, SCORE_NAME.STANDARD_SCORE]);
  });

  it('clamps age before keying (age 600 → 216 still has no row → [])', () => {
    expect(
      buildCompositeNormScoreRows({
        runId,
        composite: 0.7,
        demographics: { ageMonths: 600, grade: null },
        tableRows,
        keying: FOUNDATIONAL_COMPOSITE_KEYING,
      }),
    ).toEqual([]);
  });

  it('returns [] when demographics are unavailable or no row matches', () => {
    expect(
      buildCompositeNormScoreRows({
        runId,
        composite: 0.7,
        demographics: { ageMonths: null, grade: null },
        tableRows,
        keying: FOUNDATIONAL_COMPOSITE_KEYING,
      }),
    ).toEqual([]);
    expect(
      buildCompositeNormScoreRows({
        runId,
        composite: 9.9,
        demographics: { ageMonths: 120, grade: 4 },
        tableRows,
        keying: FOUNDATIONAL_COMPOSITE_KEYING,
      }),
    ).toEqual([]);
  });

  it('preserves string percentile sentinels like ">99"', () => {
    const rows = buildCompositeNormScoreRows({
      runId,
      composite: 3.2,
      demographics: { ageMonths: 120, grade: 4 },
      tableRows: [{ ageMonths: 120, thetaEstimate: 3.2, percentile: '>99', standardScore: 145 }],
      keying: FOUNDATIONAL_COMPOSITE_KEYING,
    });
    expect(rows.find((r) => r.name === SCORE_NAME.PERCENTILE)?.value).toBe('>99');
  });
});
