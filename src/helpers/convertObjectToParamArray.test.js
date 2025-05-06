import { describe, it, expect } from 'vitest';
import { convertObjectToParamArray } from './convertObjectToParamArray';

describe('convertObjectToParamArray', () => {
  it('should convert an empty object to an empty array', () => {
    const obj = {};
    const result = convertObjectToParamArray(obj);
    expect(result).toEqual([]);
  });

  it('should convert an object with string values to an array of objects with name, value, and type properties', () => {
    const obj = { name: 'John', lastName: 'Doe' };
    const result = convertObjectToParamArray(obj);
    expect(result).toEqual([
      { name: 'name', value: 'John', type: 'string' },
      { name: 'lastName', value: 'Doe', type: 'string' },
    ]);
  });

  it('should handle objects with different value types', () => {
    const obj = {
      name: 'John',
      age: 30,
      isStudent: true,
      hobbies: ['reading', 'swimming'],
      address: { city: 'New York', country: 'USA' },
    };
    const result = convertObjectToParamArray(obj);
    expect(result).toEqual([
      { name: 'name', value: 'John', type: 'string' },
      { name: 'age', value: 30, type: 'number' },
      { name: 'isStudent', value: true, type: 'boolean' },
      { name: 'hobbies', value: ['reading', 'swimming'], type: 'object' },
      { name: 'address', value: { city: 'New York', country: 'USA' }, type: 'object' },
    ]);
  });
});
