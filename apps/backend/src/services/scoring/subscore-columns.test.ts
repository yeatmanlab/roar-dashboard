import { describe, it, expect } from 'vitest';
import {
  getSubscoresConfig,
  getPublicSubscoreColumns,
  getNumericFieldForSubscore,
  formatTaskSubscoreColumnValue,
} from './scoring.service';
import type { SubscoreColumn } from './scoring.config-schema';

/**
 * Config-driven subscore-column behavior. These replace the dormant
 * `subscore-table.registry.test.ts` — the column definitions now live in the
 * scoring config (sourced from @roar-platform/assessment-schema for verified
 * tasks), and the helpers operate on `getSubscoresConfig`.
 */
describe('subscore columns (config-driven)', () => {
  describe('getSubscoresConfig allowlist', () => {
    it('exposes the five subscore-table task families', () => {
      for (const slug of ['pa', 'phonics', 'letter', 'roam-alpaca', 'fluency-arf']) {
        expect(getSubscoresConfig(slug)).not.toBeNull();
      }
    });

    it('returns null for tasks without a subscores block', () => {
      for (const slug of ['swr', 'sre', 'vocab', 'unknown-task']) {
        expect(getSubscoresConfig(slug)).toBeNull();
      }
    });
  });

  describe('getPublicSubscoreColumns', () => {
    it('exposes only key + label, in declared order', () => {
      const pa = getPublicSubscoreColumns('pa');
      expect(pa).toEqual([
        { key: 'FSM', label: 'First Sound' },
        { key: 'LSM', label: 'Last Sound' },
        { key: 'DEL', label: 'Deletion' },
        { key: 'total', label: 'Total' },
        { key: 'skillsToWorkOn', label: 'Skills To Work On' },
      ]);
    });

    it('phonics columns are ordered with the % total last', () => {
      const cols = getPublicSubscoreColumns('phonics');
      expect(cols?.[0]).toEqual({ key: 'cvc', label: 'CVC' });
      expect(cols?.at(-1)).toEqual({ key: 'totalPercentCorrect', label: 'Total % Correct' });
    });

    it('returns null for tasks without subscores', () => {
      expect(getPublicSubscoreColumns('swr')).toBeNull();
    });
  });

  describe('getNumericFieldForSubscore', () => {
    it('returns the generic percent name + domain for a PA sub-skill (generic names under domains)', () => {
      expect(getNumericFieldForSubscore('pa', 'FSM')).toEqual({ scoreName: 'percentCorrect', scoreDomain: 'FSM' });
      expect(getNumericFieldForSubscore('pa', 'DEL')).toEqual({ scoreName: 'percentCorrect', scoreDomain: 'DEL' });
    });

    it('returns null for an itemLevel column without a percentCorrectName (PA total)', () => {
      expect(getNumericFieldForSubscore('pa', 'total')).toBeNull();
    });

    it('returns null for a phonics sub-skill (no per-skill percent emitted)', () => {
      expect(getNumericFieldForSubscore('phonics', 'cvc')).toBeNull();
    });

    it('returns a bare scoreName (no domain) for a distinct-name number column', () => {
      expect(getNumericFieldForSubscore('phonics', 'totalPercentCorrect')).toEqual({
        scoreName: 'totalPercentCorrect',
      });
      expect(getNumericFieldForSubscore('roam-alpaca', 'rawScore')).toEqual({ scoreName: 'roarScore' });
    });

    it('returns scoreName + domain for a domain-scoped number column (roam-alpaca subtasks share subPercentCorrect)', () => {
      expect(getNumericFieldForSubscore('roam-alpaca', 'numberKnowledge')).toEqual({
        scoreName: 'subPercentCorrect',
        scoreDomain: 'numberKnowledge',
      });
      expect(getNumericFieldForSubscore('roam-alpaca', 'geometry')).toEqual({
        scoreName: 'subPercentCorrect',
        scoreDomain: 'geometry',
      });
    });

    it('returns null for paSkillsToWorkOn, stringPassthrough, and unknown keys', () => {
      expect(getNumericFieldForSubscore('pa', 'skillsToWorkOn')).toBeNull();
      expect(getNumericFieldForSubscore('letter', 'lettersToWorkOn')).toBeNull();
      expect(getNumericFieldForSubscore('pa', 'nope')).toBeNull();
      expect(getNumericFieldForSubscore('unknown-task', 'FSM')).toBeNull();
    });
  });

  describe('formatTaskSubscoreColumnValue', () => {
    const itemLevel: SubscoreColumn = {
      kind: 'itemLevel',
      key: 'cvc',
      label: 'CVC',
      correctName: 'cvcCorrect',
      attemptedName: 'cvcAttempted',
      subskill: true,
    };

    it('itemLevel renders "correct/attempted"', () => {
      const scoreMap = new Map([
        ['cvcCorrect', '15'],
        ['cvcAttempted', '19'],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('15/19');
    });

    it('itemLevel with a domain looks up via the domain map (PA generic names)', () => {
      const paColumn: SubscoreColumn = {
        kind: 'itemLevel',
        key: 'FSM',
        label: 'First Sound',
        domain: 'FSM',
        correctName: 'numCorrect',
        attemptedName: 'numAttempted',
        subskill: true,
      };
      const domainScoreMap = new Map([
        [
          'FSM',
          new Map([
            ['numCorrect', '10'],
            ['numAttempted', '20'],
          ]),
        ],
        [
          'LSM',
          new Map([
            ['numCorrect', '18'],
            ['numAttempted', '20'],
          ]),
        ],
      ]);
      // The flat map has a colliding numCorrect from another domain; the domain
      // map must win for the FSM column.
      const scoreMap = new Map([
        ['numCorrect', '18'],
        ['numAttempted', '20'],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: paColumn, scoreMap, domainScoreMap })).toBe('10/20');
    });

    it('itemLevel returns null when both halves are missing', () => {
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap: new Map() })).toBeNull();
    });

    it('itemLevel defaults a missing half to "0"', () => {
      const scoreMap = new Map([['cvcCorrect', '8']]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('8/0');
    });

    it('itemLevel preserves angle-bracket display values', () => {
      const scoreMap = new Map([
        ['cvcCorrect', '>99'],
        ['cvcAttempted', '100'],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: itemLevel, scoreMap })).toBe('>99/100');
    });

    it('number rounds when round=true and rejects non-numeric values', () => {
      const rounded: SubscoreColumn = {
        kind: 'number',
        key: 't',
        label: 'T',
        name: 'totalPercentCorrect',
        round: true,
      };
      expect(
        formatTaskSubscoreColumnValue({ column: rounded, scoreMap: new Map([['totalPercentCorrect', '78.5']]) }),
      ).toBe(79);
      const raw: SubscoreColumn = { kind: 'number', key: 'r', label: 'R', name: 'roarScore' };
      expect(formatTaskSubscoreColumnValue({ column: raw, scoreMap: new Map([['roarScore', '12.4']]) })).toBe(12.4);
      expect(formatTaskSubscoreColumnValue({ column: raw, scoreMap: new Map([['roarScore', 'NaNish']]) })).toBeNull();
      expect(formatTaskSubscoreColumnValue({ column: raw, scoreMap: new Map() })).toBeNull();
    });

    it('stringPassthrough forwards the raw value (or null when absent)', () => {
      const col: SubscoreColumn = { kind: 'stringPassthrough', key: 'l', label: 'L', name: 'incorrectLetters' };
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map([['incorrectLetters', 'q, x, z']]) })).toBe(
        'q, x, z',
      );
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map() })).toBeNull();
    });

    it('paSkillsToWorkOn joins the list, or null when empty/absent', () => {
      const col: SubscoreColumn = { kind: 'paSkillsToWorkOn', key: 'skillsToWorkOn', label: 'Skills To Work On' };
      expect(
        formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map(), paSkillsToWorkOn: ['FSM', 'DEL'] }),
      ).toBe('FSM, DEL');
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map(), paSkillsToWorkOn: [] })).toBeNull();
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map(), paSkillsToWorkOn: null })).toBeNull();
    });

    it('stringPassthrough with a domain reads from the domain map (letter subScore)', () => {
      const col: SubscoreColumn = {
        kind: 'stringPassthrough',
        key: 'lowerCase',
        label: 'Lower Case',
        name: 'subScore',
        domain: 'LowercaseNames',
      };
      const domainScoreMap = new Map([
        ['LowercaseNames', new Map([['subScore', '22']])],
        ['UppercaseNames', new Map([['subScore', '24']])],
      ]);
      // Flat map has a colliding subScore from another domain; the domain map wins.
      const scoreMap = new Map([['subScore', '24']]);
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap, domainScoreMap })).toBe('22');
    });

    it('letterToWorkOn merges its domain-indexed source lists (or null when all empty)', () => {
      const col: SubscoreColumn = {
        kind: 'letterToWorkOn',
        key: 'lettersToWorkOn',
        label: 'Letters To Work On',
        sources: [
          { name: 'upperIncorrect', domain: 'UppercaseNames' },
          { name: 'lowerIncorrect', domain: 'LowercaseNames' },
        ],
      };
      const domainScoreMap = new Map([
        ['UppercaseNames', new Map([['upperIncorrect', 'Z']])],
        ['LowercaseNames', new Map([['lowerIncorrect', 'q, x']])],
      ]);
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map(), domainScoreMap })).toBe('Z, q, x');
      // Missing one source: surface only the present one.
      expect(
        formatTaskSubscoreColumnValue({
          column: col,
          scoreMap: new Map(),
          domainScoreMap: new Map([['LowercaseNames', new Map([['lowerIncorrect', 'q']])]]),
        }),
      ).toBe('q');
      // All sources absent → null.
      expect(formatTaskSubscoreColumnValue({ column: col, scoreMap: new Map(), domainScoreMap: new Map() })).toBeNull();
    });
  });
});
