import { describe, it, expect } from 'vitest';
import { convertParamArrayToObject } from './convertParamArrayToObject';

describe('convertParamArrayToObject', () => {
  it('should convert an empty array to an empty object', () => {
    const array = [];
    const result = convertParamArrayToObject(array);
    expect(result).toEqual({});
  });

  it('should convert an array of objects with name and value properties to an object', () => {
    const array = [
      { name: 'first_name', value: 'John' },
      { name: 'last_name', value: 'Doe' },
    ];
    const result = convertParamArrayToObject(array);
    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('should handle an array wrapped in an object with value property', () => {
    const paramArray = {
      value: [
        { name: 'first_name', value: 'John' },
        { name: 'last_name', value: 'Doe' },
      ],
    };
    const result = convertParamArrayToObject(paramArray);
    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('should skip items without a name property', () => {
    const array = [
      { name: 'first_name', value: 'John' },
      { value: 'Doe' }, // No name property
      { name: 'age', value: 30 },
    ];
    const result = convertParamArrayToObject(array);
    expect(result).toEqual({
      firstName: 'John',
      age: 30,
    });
  });
});
