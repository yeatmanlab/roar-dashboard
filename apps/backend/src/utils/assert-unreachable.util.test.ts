import { describe, it, expect } from 'vitest';
import { assertUnreachable } from './assert-unreachable.util';

describe('assertUnreachable', () => {
  it('throws with the supplied message and the offending value', () => {
    // The `never` parameter is the whole point of the helper, so exercising the runtime
    // behaviour requires handing it a value the type system would otherwise reject.
    expect(() => assertUnreachable('archived' as never, 'Unsupported status')).toThrow('Unsupported status: archived');
  });

  it('stringifies non-string values rather than interpolating undefined', () => {
    expect(() => assertUnreachable(7 as never, 'Unsupported code')).toThrow('Unsupported code: 7');
    expect(() => assertUnreachable(undefined as never, 'Unsupported code')).toThrow('Unsupported code: undefined');
  });
});
