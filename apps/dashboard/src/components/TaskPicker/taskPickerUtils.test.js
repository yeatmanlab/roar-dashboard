import { describe, it, expect } from 'vitest';
import { CARD_TYPES, mergeSelectedVariants } from './taskPickerUtils';

const makeVariant = (id, taskId, params = {}) => ({
  id,
  task: { id: taskId },
  variant: { id, params },
});

describe('mergeSelectedVariants', () => {
  it('decorates incoming variants with the variant card type', () => {
    const incoming = [makeVariant('variant-a', 'swr')];

    const result = mergeSelectedVariants([], incoming);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(CARD_TYPES.VARIANT);
    expect(result[0].id).toBe('variant-a');
  });

  it('does not duplicate variants when the same selection is merged twice', () => {
    const incoming = [makeVariant('variant-a', 'swr'), makeVariant('variant-b', 'pa')];

    const firstMerge = mergeSelectedVariants([], incoming);
    const secondMerge = mergeSelectedVariants(firstMerge, incoming);

    expect(secondMerge.map((variant) => variant.id)).toEqual(['variant-a', 'variant-b']);
  });

  it('de-duplicates against entries the previous merge replaced with new objects', () => {
    // Regression for #2276: decorating replaces every entry with a new object, so an
    // identity-based merge stops matching and re-appends the whole selection.
    const incoming = [makeVariant('variant-a', 'swr')];
    const alreadySelected = mergeSelectedVariants([], incoming);

    expect(alreadySelected[0]).not.toBe(incoming[0]);
    expect(mergeSelectedVariants(alreadySelected, incoming)).toHaveLength(1);
  });

  it('stays stable across repeated merges', () => {
    const incoming = [makeVariant('variant-a', 'swr'), makeVariant('variant-b', 'pa')];

    let selection = [];
    for (let merge = 0; merge < 5; merge += 1) {
      selection = mergeSelectedVariants(selection, incoming);
    }

    expect(selection).toHaveLength(2);
  });

  it('applies conditions from the matching pre-existing assessment', () => {
    const incoming = [makeVariant('variant-a', 'swr')];
    const preExisting = [{ variantId: 'variant-a', conditions: { assigned: { field: 'studentData.grade' } } }];

    const result = mergeSelectedVariants([], incoming, preExisting);

    expect(result[0].variant.conditions).toEqual({ assigned: { field: 'studentData.grade' } });
    expect(result[0].variant.params).toEqual({});
  });

  it('does not overwrite conditions edited after the variant entered the selection', () => {
    // updateVariant edits conditions on an already-selected card. A later merge must not reset
    // them to the saved assessment's conditions, so this helper stays correct on its own rather
    // than relying on the parent never re-supplying inputVariants.
    const incoming = [makeVariant('variant-a', 'swr')];
    const preExisting = [{ variantId: 'variant-a', conditions: { assigned: { value: 'saved' } } }];

    const hydrated = mergeSelectedVariants([], incoming, preExisting);
    const edited = hydrated.map((variant) => ({
      ...variant,
      variant: { ...variant.variant, conditions: { assigned: { value: 'edited by the user' } } },
    }));

    const result = mergeSelectedVariants(edited, incoming, preExisting);

    expect(result[0].variant.conditions).toEqual({ assigned: { value: 'edited by the user' } });
  });

  it('leaves conditions unset for variants without a pre-existing assessment', () => {
    const incoming = [makeVariant('variant-a', 'swr')];
    const preExisting = [{ variantId: 'some-other-variant', conditions: { assigned: {} } }];

    const result = mergeSelectedVariants([], incoming, preExisting);

    expect(result[0].variant.conditions).toBeUndefined();
  });

  it('preserves the existing order and appends genuinely new variants', () => {
    const existing = mergeSelectedVariants([], [makeVariant('variant-b', 'pa'), makeVariant('variant-a', 'swr')]);
    const incoming = [makeVariant('variant-a', 'swr'), makeVariant('variant-c', 'letter')];

    const result = mergeSelectedVariants(existing, incoming);

    expect(result.map((variant) => variant.id)).toEqual(['variant-b', 'variant-a', 'variant-c']);
  });

  it('does not mutate the arrays it is given', () => {
    const existing = [makeVariant('variant-a', 'swr')];
    const incoming = [makeVariant('variant-b', 'pa')];

    mergeSelectedVariants(existing, incoming);

    expect(existing).toHaveLength(1);
    expect(existing[0].type).toBeUndefined();
    expect(incoming).toHaveLength(1);
    expect(incoming[0].type).toBeUndefined();
  });

  it('defaults to no pre-existing assessment info', () => {
    expect(() => mergeSelectedVariants([], [makeVariant('variant-a', 'swr')])).not.toThrow();
  });
});
