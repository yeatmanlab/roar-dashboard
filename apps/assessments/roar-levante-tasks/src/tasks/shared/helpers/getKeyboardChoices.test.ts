import { describe, it, expect } from 'vitest';
import { getKeyboardChoices } from './getKeyboardChoices';

// Minimal stand-in for the only field getKeyboardChoices reads.
const cfg = (numValues: number): any => ({
  response: { values: Array.from({ length: numValues }, (_, i) => i) },
});

describe('getKeyboardChoices', () => {
  it('returns Enter for a single (instruction) button', () => {
    expect(getKeyboardChoices(cfg(1))).toEqual(['Enter']);
  });

  it('maps 2 buttons to left/right', () => {
    expect(getKeyboardChoices(cfg(2))).toEqual(['ArrowLeft', 'ArrowRight']);
  });

  it('maps 3 buttons to up/left/right', () => {
    expect(getKeyboardChoices(cfg(3))).toEqual(['ArrowUp', 'ArrowLeft', 'ArrowRight']);
  });

  it('maps 4 buttons to up/left/right/down', () => {
    expect(getKeyboardChoices(cfg(4))).toEqual(['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']);
  });

  it('throws for more than 4 buttons', () => {
    expect(() => getKeyboardChoices(cfg(5))).toThrow('More than 4 buttons are not supported yet');
  });
});
