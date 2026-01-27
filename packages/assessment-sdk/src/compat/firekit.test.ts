import { describe, it, expect, expectTypeOf } from 'vitest';
import { addInteraction } from './firekit';
import { SDKError } from '../errors/sdk-error';
import type { InteractionEvent } from '../types';

describe('firekit compat', () => {
  describe('addInteraction', () => {
    it('throws SDKError when called', () => {
      expect(() => addInteraction({ type: 'click' })).toThrow(SDKError);
      expect(() => addInteraction({ foo: 'bar' })).toThrow(SDKError);
    });

    it('matches Firekit signature', () => {
      // runtime assertion to satisfy vitest/expect-expect
      expect(typeof addInteraction).toBe('function');

      // compile-time signature check
      expectTypeOf(addInteraction).toEqualTypeOf<(interaction: InteractionEvent) => void>();
    });
  });
});
