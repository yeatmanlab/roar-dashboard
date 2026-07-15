import { describe, it, expect } from 'vitest';
import { toRoamFluencyScoreEntries, toRoamAlpacaScoreEntries } from './score-entries.js';
import {
  ROAM_FLUENCY_SUBTASK_SCORE_NAMES,
  ROAM_FLUENCY_COMPOSITE_SCORE_NAMES,
  ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES,
  ROAM_ALPACA_SUBTASK_SCORE_NAMES,
  ROAM_ALPACA_COMPOSITE_SCORE_NAMES,
} from './score-names.js';
import { ROAM_FLUENCY_SUBTASK_DOMAINS, ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS, ROAM_ALPACA_SUBTASK_DOMAINS } from './domains.js';
import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';

describe('toRoamFluencyScoreEntries', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty object', {}],
  ])('returns [] when computed is %s', (_label, input) => {
    expect(toRoamFluencyScoreEntries(input)).toEqual([]);
  });

  it('skips a domain whose value is null or not an object', () => {
    expect(
      toRoamFluencyScoreEntries({
        [ROAM_FLUENCY_SUBTASK_DOMAINS.ADDITION]: null as unknown as Record<string, unknown>,
      }),
    ).toEqual([]);
  });

  describe('standard operator subtask domains', () => {
    it('emits all fields for a full-shape subtask (addition)', () => {
      const entries = toRoamFluencyScoreEntries({
        [ROAM_FLUENCY_SUBTASK_DOMAINS.ADDITION]: {
          numCorrect: 8,
          numIncorrect: 2,
          numAttempted: 10,
          rawScore: 8,
          subPercentCorrect: 0.8,
          skillsAssessed: 'Less than 10, Doubles',
        },
      });

      expect(entries).toHaveLength(6);
      for (const name of [
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_CORRECT,
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
      ]) {
        expect(entries).toContainEqual(
          expect.objectContaining({ type: 'raw', domain: 'addition', name, assessmentStage: 'test' }),
        );
      }
      for (const name of [
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.RAW_SCORE,
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
        ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SKILLS_ASSESSED,
      ]) {
        expect(entries).toContainEqual(
          expect.objectContaining({ type: 'computed', domain: 'addition', name, assessmentStage: 'test' }),
        );
      }
    });

    it('skips absent fields rather than writing them as empty', () => {
      const entries = toRoamFluencyScoreEntries({
        [ROAM_FLUENCY_SUBTASK_DOMAINS.DIVISION]: { numCorrect: 5, numIncorrect: 1, numAttempted: 6, rawScore: 5 },
      });

      expect(entries).toHaveLength(4);
      expect(
        entries.some(
          (e) =>
            e.name === ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT ||
            e.name === ROAM_FLUENCY_SUBTASK_SCORE_NAMES.SKILLS_ASSESSED,
        ),
      ).toBe(false);
    });
  });

  describe('reduced-shape subtask domains (symbolicComp, response modality)', () => {
    it('emits only the base 4 fields for symbolicComp (magpiPilot, fluency-arf only)', () => {
      const entries = toRoamFluencyScoreEntries({
        [ROAM_FLUENCY_SUBTASK_DOMAINS.SYMBOLIC_COMP]: {
          numCorrect: 4,
          numIncorrect: 1,
          numAttempted: 5,
          rawScore: 4,
        },
      });

      expect(entries).toHaveLength(4);
      expect(entries.every((e) => e.domain === 'symbolicComp')).toBe(true);
    });

    it('emits only the base 4 fields for a responseModality domain (FC)', () => {
      const entries = toRoamFluencyScoreEntries({
        [ROAM_FLUENCY_RESPONSE_MODALITY_SUBTASK_DOMAINS.MULTIPLE_CHOICE]: {
          numCorrect: 3,
          numIncorrect: 0,
          numAttempted: 3,
          rawScore: 3,
        },
      });

      expect(entries).toHaveLength(4);
      expect(entries.every((e) => e.domain === 'FC')).toBe(true);
    });
  });

  describe('composite domain — flat fields', () => {
    it('emits counts as raw and rawScore/subPercentCorrect as computed', () => {
      const entries = toRoamFluencyScoreEntries({
        [COMPOSITE_DOMAIN]: { numCorrect: 20, numIncorrect: 5, numAttempted: 25, rawScore: 20, subPercentCorrect: 0.8 },
      });

      expect(entries).toHaveLength(5);
      for (const name of [
        ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
        ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_INCORRECT,
        ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_ATTEMPTED,
      ]) {
        expect(entries).toContainEqual(expect.objectContaining({ type: 'raw', domain: 'composite', name }));
      }
      for (const name of [ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.RAW_SCORE, ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.SUB_PERCENT_CORRECT]) {
        expect(entries).toContainEqual(expect.objectContaining({ type: 'computed', domain: 'composite', name }));
      }
    });

    it('emits only the base 4 fields for the responseModality composite shape', () => {
      const entries = toRoamFluencyScoreEntries({
        [COMPOSITE_DOMAIN]: { numCorrect: 12, numIncorrect: 3, numAttempted: 15, rawScore: 12 },
      });

      expect(entries).toHaveLength(4);
    });
  });

  describe('composite domain — incorrectSkills flattening', () => {
    it('flattens each operator key to its own <operator>IncorrectSkills entry, never emitting "incorrectSkills" itself', () => {
      const entries = toRoamFluencyScoreEntries({
        [COMPOSITE_DOMAIN]: {
          numCorrect: 20,
          numIncorrect: 5,
          numAttempted: 25,
          incorrectSkills: { multiplication: '6s facts', division: 'Perfect Squares' },
        },
      });

      // 3 counts + 2 flattened incorrectSkills entries; incorrectSkills itself never
      // appears verbatim as its own "incorrectSkills"-named entry.
      expect(entries).toHaveLength(5);
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.MULTIPLICATION_INCORRECT_SKILLS,
        value: '6s facts',
        assessmentStage: 'test',
      });
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: ROAM_FLUENCY_INCORRECT_SKILLS_SCORE_NAMES.DIVISION_INCORRECT_SKILLS,
        value: 'Perfect Squares',
        assessmentStage: 'test',
      });
      expect(entries.map((e) => e.name)).not.toContain('incorrectSkills');
    });

    it('ignores an unrecognized operator key in incorrectSkills', () => {
      const computed = { [COMPOSITE_DOMAIN]: { incorrectSkills: { modulo: 'shouldNotAppear' } } };
      expect(() => toRoamFluencyScoreEntries(computed)).not.toThrow();
      expect(toRoamFluencyScoreEntries(computed)).toEqual([]);
    });

    it('skips an empty-string incorrectSkills value for an operator', () => {
      const entries = toRoamFluencyScoreEntries({
        [COMPOSITE_DOMAIN]: { incorrectSkills: { multiplication: '' } },
      });
      expect(entries).toEqual([]);
    });

    it('does nothing when incorrectSkills is absent', () => {
      const entries = toRoamFluencyScoreEntries({ [COMPOSITE_DOMAIN]: { numCorrect: 1 } });
      expect(entries).toEqual([
        {
          type: 'raw',
          domain: 'composite',
          name: ROAM_FLUENCY_COMPOSITE_SCORE_NAMES.NUM_CORRECT,
          value: '1',
          assessmentStage: 'test',
        },
      ]);
    });
  });

  it('converts numeric values to strings', () => {
    const entries = toRoamFluencyScoreEntries({ [ROAM_FLUENCY_SUBTASK_DOMAINS.ADDITION]: { numCorrect: 7 } });
    expect(entries[0]!.value).toBe('7');
    expect(typeof entries[0]!.value).toBe('string');
  });

  describe('strict mode', () => {
    it('throws on an unrecognized top-level domain', () => {
      expect(() => toRoamFluencyScoreEntries({ bogus: { numCorrect: 1 } }, { strict: true })).toThrow(/bogus/);
    });

    it.each([
      ['the composite domain', { [COMPOSITE_DOMAIN]: { numCorrect: 1 } }],
      ['a recognized subtask domain', { [ROAM_FLUENCY_SUBTASK_DOMAINS.SYMBOLIC_COMP]: { numCorrect: 1 } }],
    ])('does not throw on %s', (_label, computed) => {
      expect(() => toRoamFluencyScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('ignores an unrecognized top-level domain when strict is off (never emits it)', () => {
      const entries = toRoamFluencyScoreEntries({
        bogus: { numCorrect: 99 },
        [ROAM_FLUENCY_SUBTASK_DOMAINS.ADDITION]: { numCorrect: 5 },
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ domain: 'addition', name: ROAM_FLUENCY_SUBTASK_SCORE_NAMES.NUM_CORRECT, value: '5' });
    });
  });
});

describe('toRoamAlpacaScoreEntries', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty object', {}],
  ])('returns [] when computed is %s', (_label, input) => {
    expect(toRoamAlpacaScoreEntries(input)).toEqual([]);
  });

  describe('standard alpaca subtask domains', () => {
    it('emits all fields for a full-shape subtask (geometry)', () => {
      const entries = toRoamAlpacaScoreEntries({
        [ROAM_ALPACA_SUBTASK_DOMAINS.GEOMETRY]: {
          numCorrect: 9,
          numIncorrect: 1,
          numAttempted: 10,
          rawScore: 9,
          subPercentCorrect: 0.9,
          gradeEstimate: 4,
          supportLevel: 'accessible',
        },
      });

      expect(entries).toHaveLength(7);
      for (const name of [
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_CORRECT,
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_INCORRECT,
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_ATTEMPTED,
      ]) {
        expect(entries).toContainEqual(expect.objectContaining({ type: 'raw', domain: 'geometry', name }));
      }
      for (const name of [
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.RAW_SCORE,
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUB_PERCENT_CORRECT,
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.GRADE_ESTIMATE,
        ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUPPORT_LEVEL,
      ]) {
        expect(entries).toContainEqual(expect.objectContaining({ type: 'computed', domain: 'geometry', name }));
      }
    });

    it('skips absent fields rather than writing them as empty', () => {
      const entries = toRoamAlpacaScoreEntries({
        [ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_KNOWLEDGE]: { numCorrect: 3, numIncorrect: 0, numAttempted: 3 },
      });

      expect(entries).toHaveLength(3);
      expect(
        entries.some(
          (e) =>
            e.name === ROAM_ALPACA_SUBTASK_SCORE_NAMES.GRADE_ESTIMATE || e.name === ROAM_ALPACA_SUBTASK_SCORE_NAMES.SUPPORT_LEVEL,
        ),
      ).toBe(false);
    });
  });

  it('emits only the base 4 fields for numberLine (magpiPilot only, reduced shape)', () => {
    const entries = toRoamAlpacaScoreEntries({
      [ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_LINE]: { numCorrect: 6, numIncorrect: 2, numAttempted: 8, rawScore: 6 },
    });

    expect(entries).toHaveLength(4);
    expect(entries.every((e) => e.domain === 'numberLine')).toBe(true);
  });

  describe('composite domain', () => {
    it('emits thetaEstimateRaw and counts as raw, everything else as computed', () => {
      const entries = toRoamAlpacaScoreEntries({
        [COMPOSITE_DOMAIN]: {
          numCorrect: 30,
          numIncorrect: 5,
          numAttempted: 35,
          thetaEstimateRaw: 0.42,
          thetaEstimate: 0.5,
          roarScore: 128,
          rawScore: 30,
          gradeEstimate: 3,
          supportLevel: 'some support',
          incorrectSkills: 'Single-digit number knowledge, Division',
        },
      });

      expect(entries).toContainEqual(
        expect.objectContaining({ type: 'raw', name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE_RAW }),
      );
      expect(entries).toContainEqual(expect.objectContaining({ type: 'raw', name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.NUM_CORRECT }));
      expect(entries).toContainEqual(
        expect.objectContaining({ type: 'computed', name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.THETA_ESTIMATE }),
      );
      expect(entries).toContainEqual(expect.objectContaining({ type: 'computed', name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.ROAR_SCORE }));
      expect(entries).toContainEqual({
        type: 'computed',
        domain: 'composite',
        name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.INCORRECT_SKILLS,
        value: 'Single-digit number knowledge, Division',
        assessmentStage: 'test',
      });
    });

    it('treats incorrectSkills as a single flat string, never flattened by sub-key', () => {
      const entries = toRoamAlpacaScoreEntries({
        [COMPOSITE_DOMAIN]: { incorrectSkills: 'Single-digit number knowledge, Division' },
      });

      expect(entries).toEqual([
        {
          type: 'computed',
          domain: 'composite',
          name: ROAM_ALPACA_COMPOSITE_SCORE_NAMES.INCORRECT_SKILLS,
          value: 'Single-digit number knowledge, Division',
          assessmentStage: 'test',
        },
      ]);
    });

    it('skips an empty-string incorrectSkills value', () => {
      const entries = toRoamAlpacaScoreEntries({ [COMPOSITE_DOMAIN]: { incorrectSkills: '' } });
      expect(entries).toEqual([]);
    });
  });

  it('converts numeric values to strings', () => {
    const entries = toRoamAlpacaScoreEntries({ [ROAM_ALPACA_SUBTASK_DOMAINS.GEOMETRY]: { numCorrect: 4 } });
    expect(entries[0]!.value).toBe('4');
    expect(typeof entries[0]!.value).toBe('string');
  });

  describe('strict mode', () => {
    it('throws on an unrecognized top-level domain', () => {
      expect(() => toRoamAlpacaScoreEntries({ bogus: { numCorrect: 1 } }, { strict: true })).toThrow(/bogus/);
    });

    it.each([
      ['the composite domain', { [COMPOSITE_DOMAIN]: { numCorrect: 1 } }],
      ['numberLine', { [ROAM_ALPACA_SUBTASK_DOMAINS.NUMBER_LINE]: { numCorrect: 1 } }],
    ])('does not throw on %s', (_label, computed) => {
      expect(() => toRoamAlpacaScoreEntries(computed, { strict: true })).not.toThrow();
    });

    it('ignores an unrecognized top-level domain when strict is off (never emits it)', () => {
      const entries = toRoamAlpacaScoreEntries({
        bogus: { numCorrect: 99 },
        [ROAM_ALPACA_SUBTASK_DOMAINS.GEOMETRY]: { numCorrect: 5 },
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ domain: 'geometry', name: ROAM_ALPACA_SUBTASK_SCORE_NAMES.NUM_CORRECT, value: '5' });
    });
  });
});
