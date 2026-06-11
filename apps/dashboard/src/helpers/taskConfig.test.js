import { describe, it, expect } from 'vitest';
import {
  buildTaskConfigFromRows,
  buildVariantParametersFromRows,
  isEditableTaskConfigValue,
  splitTaskConfig,
  splitVariantParameters,
  variantParametersToMap,
} from './taskConfig';

describe('isEditableTaskConfigValue', () => {
  it('accepts strings, numbers, and booleans', () => {
    expect(isEditableTaskConfigValue('easy')).toBe(true);
    expect(isEditableTaskConfigValue(42)).toBe(true);
    expect(isEditableTaskConfigValue(false)).toBe(true);
  });

  it('rejects null, arrays, and objects', () => {
    expect(isEditableTaskConfigValue(null)).toBe(false);
    expect(isEditableTaskConfigValue(['a', 'b'])).toBe(false);
    expect(isEditableTaskConfigValue({ nested: true })).toBe(false);
  });
});

describe('splitTaskConfig', () => {
  it('splits scalar entries into rows and non-scalars into passthrough', () => {
    const { editableRows, passthrough, canEdit } = splitTaskConfig({
      difficulty: 'hard',
      maxAttempts: 3,
      shuffle: true,
      hints: null,
      wordList: ['cat', 'dog'],
      adaptive: { mode: 'cat' },
    });

    expect(canEdit).toBe(true);
    expect(editableRows).toEqual([
      { name: 'difficulty', value: 'hard', type: 'string' },
      { name: 'maxAttempts', value: 3, type: 'number' },
      { name: 'shuffle', value: true, type: 'boolean' },
    ]);
    expect(passthrough).toEqual({
      hints: null,
      wordList: ['cat', 'dog'],
      adaptive: { mode: 'cat' },
    });
  });

  it('treats null/undefined taskConfig as an empty editable config', () => {
    expect(splitTaskConfig(null)).toEqual({ editableRows: [], passthrough: {}, canEdit: true });
    expect(splitTaskConfig(undefined)).toEqual({ editableRows: [], passthrough: {}, canEdit: true });
  });

  it('disables editing entirely for non-plain-object taskConfig', () => {
    expect(splitTaskConfig(['not', 'an', 'object']).canEdit).toBe(false);
    expect(splitTaskConfig('just a string').canEdit).toBe(false);
    expect(splitTaskConfig(7).canEdit).toBe(false);
  });
});

describe('buildTaskConfigFromRows', () => {
  it('preserves keys verbatim — no camelCasing', () => {
    const config = buildTaskConfigFromRows([
      { name: 'max_attempts', value: 3, type: 'number' },
      { name: 'MaxRetries', value: 1, type: 'number' },
      { name: 'corpus.id', value: 'c1', type: 'string' },
    ]);

    expect(config).toEqual({ max_attempts: 3, MaxRetries: 1, 'corpus.id': 'c1' });
  });

  it('round-trips a snake_case config through split + build without changes', () => {
    const original = { max_attempts: 3, time_limit: 60, mode: 'adaptive', hints: null };

    const { editableRows, passthrough } = splitTaskConfig(original);
    const rebuilt = buildTaskConfigFromRows(editableRows, passthrough);

    expect(rebuilt).toEqual(original);
  });

  it('merges passthrough entries back and lets edited rows take precedence', () => {
    const config = buildTaskConfigFromRows([{ name: 'difficulty', value: 'easy', type: 'string' }], {
      wordList: ['cat'],
      hints: null,
    });

    expect(config).toEqual({ difficulty: 'easy', wordList: ['cat'], hints: null });
  });

  it('skips rows with blank or whitespace-only names', () => {
    const config = buildTaskConfigFromRows([
      { name: '', value: 'orphan', type: 'string' },
      { name: '   ', value: 'orphan', type: 'string' },
      { name: 'kept', value: 1, type: 'number' },
    ]);

    expect(config).toEqual({ kept: 1 });
  });
});

describe('splitVariantParameters', () => {
  it('splits scalar entries into rows and non-scalars into passthrough', () => {
    const { editableRows, passthrough, canEdit } = splitVariantParameters([
      { name: 'difficulty', value: 'hard' },
      { name: 'maxAttempts', value: 3 },
      { name: 'hints', value: null },
      { name: 'wordList', value: ['cat', 'dog'] },
    ]);

    expect(canEdit).toBe(true);
    expect(editableRows).toEqual([
      { name: 'difficulty', value: 'hard', type: 'string' },
      { name: 'maxAttempts', value: 3, type: 'number' },
    ]);
    expect(passthrough).toEqual([
      { name: 'hints', value: null },
      { name: 'wordList', value: ['cat', 'dog'] },
    ]);
  });

  it('treats null/undefined parameters as an empty editable set', () => {
    expect(splitVariantParameters(null)).toEqual({ editableRows: [], passthrough: [], canEdit: true });
    expect(splitVariantParameters(undefined)).toEqual({ editableRows: [], passthrough: [], canEdit: true });
  });

  it('disables editing for non-array parameters', () => {
    expect(splitVariantParameters({ not: 'an array' }).canEdit).toBe(false);
  });
});

describe('buildVariantParametersFromRows', () => {
  it('preserves names verbatim and merges passthrough entries', () => {
    const parameters = buildVariantParametersFromRows(
      [{ name: 'max_attempts', value: 5, type: 'number' }],
      [{ name: 'wordList', value: ['cat'] }],
    );

    expect(parameters).toEqual([
      { name: 'wordList', value: ['cat'] },
      { name: 'max_attempts', value: 5 },
    ]);
  });

  it('round-trips parameters through split + build without changes (order-insensitive)', () => {
    const original = [
      { name: 'snake_case_param', value: 'kept' },
      { name: 'hints', value: null },
      { name: 'count', value: 2 },
    ];

    const { editableRows, passthrough } = splitVariantParameters(original);
    const rebuilt = buildVariantParametersFromRows(editableRows, passthrough);

    expect(variantParametersToMap(rebuilt)).toEqual(variantParametersToMap(original));
  });

  it('skips rows with blank names', () => {
    const parameters = buildVariantParametersFromRows([
      { name: '  ', value: 'orphan', type: 'string' },
      { name: 'kept', value: true, type: 'boolean' },
    ]);

    expect(parameters).toEqual([{ name: 'kept', value: true }]);
  });
});

describe('variantParametersToMap', () => {
  it('converts an entries array into a name-keyed object', () => {
    expect(
      variantParametersToMap([
        { name: 'a', value: 1 },
        { name: 'b', value: null },
      ]),
    ).toEqual({ a: 1, b: null });
  });

  it('tolerates nullish input', () => {
    expect(variantParametersToMap(null)).toEqual({});
    expect(variantParametersToMap(undefined)).toEqual({});
  });
});
