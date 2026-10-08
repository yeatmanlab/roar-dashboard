import { describe, expect, it } from 'vitest';
import { findAdministrationVariant } from './findAdministrationVariant';

const makeVariant = (id, taskId, params) => ({
  id,
  task: { id: taskId },
  variant: { id, params },
});

describe('findAdministrationVariant', () => {
  it('preserves the saved variant ID when multiple variants have identical parameters', () => {
    const variants = [
      makeVariant('replacement-id', 'word', { corpus: 'trog' }),
      makeVariant('saved-id', 'word', { corpus: 'trog' }),
    ];

    const result = findAdministrationVariant(
      { variantId: 'saved-id', taskId: 'word', params: { corpus: 'trog' } },
      variants,
    );

    expect(result.id).toBe('saved-id');
  });

  it('uses parameters as a fallback for a legacy assessment without a variant ID', () => {
    const variants = [
      makeVariant('other-id', 'word', { corpus: 'calf' }),
      makeVariant('matching-id', 'word', { corpus: 'trog', optional: null }),
    ];

    const result = findAdministrationVariant({ taskId: 'word', params: { corpus: 'trog' } }, variants);

    expect(result.id).toBe('matching-id');
  });

  it('rejects an ambiguous legacy parameter match', () => {
    const variants = [
      makeVariant('first-id', 'word', { corpus: 'trog' }),
      makeVariant('second-id', 'word', { corpus: 'trog' }),
    ];

    expect(() => findAdministrationVariant({ taskId: 'word', params: { corpus: 'trog' } }, variants)).toThrow(
      '2 variants have the same parameters',
    );
  });

  it('rejects a legacy assessment without a matching variant', () => {
    const variants = [makeVariant('different-id', 'word', { corpus: 'calf' })];

    expect(() => findAdministrationVariant({ taskId: 'word', params: { corpus: 'trog' } }, variants)).toThrow(
      'Could not find a variant matching the legacy assessment',
    );
  });

  it('does not substitute a parameter match when the saved variant ID is unavailable', () => {
    const variants = [makeVariant('different-id', 'word', { corpus: 'trog' })];

    expect(() =>
      findAdministrationVariant({ variantId: 'missing-id', taskId: 'word', params: { corpus: 'trog' } }, variants),
    ).toThrow('The saved variant ID was not replaced');
  });
});
