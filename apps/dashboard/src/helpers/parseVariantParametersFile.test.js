import { describe, it, expect } from 'vitest';
import { parseVariantParametersJson } from './parseVariantParametersFile';

describe('parseVariantParametersJson', () => {
  it('maps a valid mixed-type array to configurator rows with isNew', () => {
    const text = JSON.stringify([
      { name: 'numberOfTrials', type: 'number', value: 30 },
      { name: 'language', type: 'string', value: 'en' },
      { name: 'adaptive', type: 'boolean', value: true },
    ]);

    expect(parseVariantParametersJson(text)).toEqual([
      { name: 'numberOfTrials', type: 'number', value: 30, isNew: true },
      { name: 'language', type: 'string', value: 'en', isNew: true },
      { name: 'adaptive', type: 'boolean', value: true, isNew: true },
    ]);
  });

  it('trims the parameter name', () => {
    const text = JSON.stringify([{ name: '  spaced  ', type: 'string', value: 'x' }]);
    expect(parseVariantParametersJson(text)[0].name).toBe('spaced');
  });

  it('returns an empty array for an empty array input', () => {
    expect(parseVariantParametersJson('[]')).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseVariantParametersJson('{not json')).toThrow(/not valid JSON/i);
  });

  it('throws when the top level is not an array', () => {
    expect(() => parseVariantParametersJson('{"name":"x","type":"string","value":"y"}')).toThrow(
      /array of parameters/i,
    );
  });

  it('throws when an entry is not an object', () => {
    expect(() => parseVariantParametersJson('["nope"]')).toThrow(/Parameter 1: each entry must be an object/);
  });

  it('throws when name is missing or blank', () => {
    expect(() => parseVariantParametersJson(JSON.stringify([{ type: 'string', value: 'y' }]))).toThrow(
      /Parameter 1: "name" must be a non-empty string/,
    );
    expect(() => parseVariantParametersJson(JSON.stringify([{ name: '   ', type: 'string', value: 'y' }]))).toThrow(
      /"name" must be a non-empty string/,
    );
  });

  it('throws when type is not one of the allowed values', () => {
    expect(() => parseVariantParametersJson(JSON.stringify([{ name: 'x', type: 'object', value: {} }]))).toThrow(
      /"type" must be one of string, number, boolean/,
    );
  });

  it('throws when the value does not match its declared type', () => {
    expect(() => parseVariantParametersJson(JSON.stringify([{ name: 'x', type: 'number', value: '5' }]))).toThrow(
      /"value" must be a number/,
    );
    expect(() => parseVariantParametersJson(JSON.stringify([{ name: 'x', type: 'boolean', value: 'true' }]))).toThrow(
      /"value" must be a boolean/,
    );
  });

  it('reports the offending entry index in the message', () => {
    const text = JSON.stringify([
      { name: 'ok', type: 'string', value: 'fine' },
      { name: 'bad', type: 'number', value: 'NaN' },
    ]);
    expect(() => parseVariantParametersJson(text)).toThrow(/Parameter 2: "value" must be a number/);
  });
});
