import { describe, it, expect } from 'vitest';
import {
  TASK_SUBSCORE_TABLE,
  getTaskSubscoreColumns,
  getPublicSubscoreColumns,
  getNumericFieldNameForSubscore,
  formatTaskSubscoreColumnValue,
} from './subscore-table.registry';
import type {
  ItemLevelColumn,
  NumberColumn,
  StringPassthroughColumn,
  PaSkillsToWorkOnColumn,
} from './subscore-table.registry';

describe('subscore-table.registry', () => {
  describe('column registry', () => {
    it('registers exactly the five known task families with subscore tables', () => {
      // Five families × variants = 9 registry entries total.
      // (letter + letter-en-ca + 4 fluency + 1 phonics + 1 pa + 1 alpaca = 9)
      const slugs = Object.keys(TASK_SUBSCORE_TABLE).sort();
      expect(slugs).toEqual(
        [
          'fluency-arf',
          'fluency-arf-es',
          'fluency-calf',
          'fluency-calf-es',
          'letter',
          'letter-en-ca',
          'pa',
          'phonics',
          'roam-alpaca',
        ].sort(),
      );
    });

    it('returns null for tasks without a registered subscore table', () => {
      expect(getTaskSubscoreColumns('swr')).toBeNull();
      expect(getTaskSubscoreColumns('sre')).toBeNull();
      expect(getTaskSubscoreColumns('vocab')).toBeNull();
      expect(getTaskSubscoreColumns('not-a-real-slug')).toBeNull();
    });

    it('exposes only key + label in the public column metadata', () => {
      const cols = getPublicSubscoreColumns('phonics');
      expect(cols).not.toBeNull();
      for (const col of cols!) {
        expect(Object.keys(col).sort()).toEqual(['key', 'label']);
      }
    });

    it('keeps phonics columns in the dashboard-rendered order', () => {
      const cols = getPublicSubscoreColumns('phonics')!;
      expect(cols.map((c) => c.key)).toEqual([
        'cvc',
        'digraph',
        'initialBlend',
        'tripleBlend',
        'finalBlend',
        'rControlled',
        'rCluster',
        'silentE',
        'vowelTeam',
        'totalPercentCorrect',
      ]);
    });

    it('keeps PA columns ending in skillsToWorkOn (the computed column)', () => {
      const cols = getPublicSubscoreColumns('pa')!;
      expect(cols.map((c) => c.key)).toEqual(['firstSound', 'lastSound', 'deletion', 'total', 'skillsToWorkOn']);
    });
  });

  describe('getNumericFieldNameForSubscore', () => {
    it('returns the percentCorrectName for itemLevel columns', () => {
      expect(getNumericFieldNameForSubscore('phonics', 'cvc')).toBe('cvcPercentCorrect');
      expect(getNumericFieldNameForSubscore('pa', 'firstSound')).toBe('fsmPercentCorrect');
    });

    it('returns the name for number columns', () => {
      expect(getNumericFieldNameForSubscore('phonics', 'totalPercentCorrect')).toBe('totalPercentCorrect');
      expect(getNumericFieldNameForSubscore('roam-alpaca', 'rawScore')).toBe('roarScore');
    });

    it('returns null for stringPassthrough columns (no numeric form)', () => {
      // letter columns are passthrough strings — none have numeric filterability.
      expect(getNumericFieldNameForSubscore('letter', 'lowerCase')).toBeNull();
      expect(getNumericFieldNameForSubscore('letter', 'lettersToWorkOn')).toBeNull();
    });

    it('returns null for the PA paSkillsToWorkOn computed column', () => {
      expect(getNumericFieldNameForSubscore('pa', 'skillsToWorkOn')).toBeNull();
    });

    it('returns null for unknown tasks or unknown keys', () => {
      expect(getNumericFieldNameForSubscore('swr', 'cvc')).toBeNull();
      expect(getNumericFieldNameForSubscore('phonics', 'notARealKey')).toBeNull();
    });
  });

  describe('formatTaskSubscoreColumnValue', () => {
    const itemLevel: ItemLevelColumn = {
      kind: 'itemLevel',
      key: 'cvc',
      label: 'CVC',
      correctName: 'cvcCorrect',
      attemptedName: 'cvcAttempted',
      percentCorrectName: 'cvcPercentCorrect',
    };
    const numberCol: NumberColumn = {
      kind: 'number',
      key: 'totalPercentCorrect',
      label: 'Total % Correct',
      name: 'totalPercentCorrect',
      round: true,
    };
    const numberColUnrounded: NumberColumn = {
      kind: 'number',
      key: 'totalPercentCorrect',
      label: 'Total % Correct',
      name: 'totalPercentCorrect',
    };
    const stringCol: StringPassthroughColumn = {
      kind: 'stringPassthrough',
      key: 'incorrectLetters',
      label: 'Letters To Work On',
      name: 'incorrectLetters',
    };
    const paSkillsCol: PaSkillsToWorkOnColumn = {
      kind: 'paSkillsToWorkOn',
      key: 'skillsToWorkOn',
      label: 'Skills To Work On',
    };

    // --- itemLevel ---

    it('formats itemLevel columns as `correct/attempted`', () => {
      const scoreMap = new Map([
        ['cvcCorrect', '15'],
        ['cvcAttempted', '19'],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('15/19');
    });

    it('returns null for itemLevel columns when both halves are absent', () => {
      const scoreMap = new Map<string, string>();
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBeNull();
    });

    it('uses "0" as a default for missing halves so partial data still renders', () => {
      const scoreMap = new Map([['cvcCorrect', '15']]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('15/0');
    });

    it('preserves angle-bracket nuance like ">99" or "<1" in itemLevel values', () => {
      const scoreMap = new Map([
        ['cvcCorrect', '>99'],
        ['cvcAttempted', '100'],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('>99/100');
    });

    // --- number ---

    it('rounds number columns when `round: true`', () => {
      const scoreMap = new Map([['totalPercentCorrect', '78.5']]);
      expect(formatTaskSubscoreColumnValue({ column: numberCol, scoreMap })).toBe(79);
    });

    it('preserves precision when `round` is omitted', () => {
      const scoreMap = new Map([['totalPercentCorrect', '78.5']]);
      expect(formatTaskSubscoreColumnValue({ column: numberColUnrounded, scoreMap })).toBe(78.5);
    });

    it('returns null for number columns when the field is missing', () => {
      expect(formatTaskSubscoreColumnValue({ column: numberCol, scoreMap: new Map() })).toBeNull();
    });

    it('returns null for number columns when the value is non-numeric', () => {
      const scoreMap = new Map([['totalPercentCorrect', 'not-a-number']]);
      expect(formatTaskSubscoreColumnValue({ column: numberCol, scoreMap })).toBeNull();
    });

    // --- stringPassthrough ---

    it('forwards stringPassthrough values as-is', () => {
      const scoreMap = new Map([['incorrectLetters', 'q, x, z']]);
      expect(formatTaskSubscoreColumnValue({ column: stringCol, scoreMap })).toBe('q, x, z');
    });

    it('returns null for stringPassthrough when the field is missing', () => {
      expect(formatTaskSubscoreColumnValue({ column: stringCol, scoreMap: new Map() })).toBeNull();
    });

    // --- paSkillsToWorkOn ---

    it('joins paSkillsToWorkOn entries into a comma-separated string', () => {
      expect(
        formatTaskSubscoreColumnValue({
          column: paSkillsCol,
          scoreMap: new Map(),
          paSkillsToWorkOn: ['DEL', 'LSM'],
        }),
      ).toBe('DEL, LSM');
    });

    it('returns null for paSkillsToWorkOn when the list is empty or undefined', () => {
      expect(formatTaskSubscoreColumnValue({ column: paSkillsCol, scoreMap: new Map() })).toBeNull();
      expect(
        formatTaskSubscoreColumnValue({
          column: paSkillsCol,
          scoreMap: new Map(),
          paSkillsToWorkOn: [],
        }),
      ).toBeNull();
      expect(
        formatTaskSubscoreColumnValue({
          column: paSkillsCol,
          scoreMap: new Map(),
          paSkillsToWorkOn: null,
        }),
      ).toBeNull();
    });
  });
});
