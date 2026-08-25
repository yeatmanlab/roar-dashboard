import { ref, nextTick } from 'vue';
import { describe, it, expect } from 'vitest';
import { useScoringVersions } from './useScoringVersions';

const makeVariant = (taskSlug, parameters = []) => ({ taskSlug, parameters });

const scoringVersionParam = (value) => ({ name: 'scoringVersion', value });

describe('useScoringVersions', () => {
  it('returns an empty map when there are no variants', () => {
    const { getScoringVersions } = useScoringVersions([]);
    expect(getScoringVersions.value).toEqual({});
  });

  it('returns an empty map when the input is null or undefined', () => {
    expect(useScoringVersions(null).getScoringVersions.value).toEqual({});
    expect(useScoringVersions(undefined).getScoringVersions.value).toEqual({});
  });

  it('maps a variant with an integer scoringVersion parameter to its task slug', () => {
    const variants = [makeVariant('swr', [scoringVersionParam(2)])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: 2 });
  });

  it('maps multiple variants across different task slugs', () => {
    const variants = [
      makeVariant('swr', [scoringVersionParam(2)]),
      makeVariant('sre', [scoringVersionParam(1)]),
      makeVariant('pa', [scoringVersionParam(0)]),
    ];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: 2, sre: 1, pa: 0 });
  });

  it('coerces a numeric-string scoringVersion value to an integer', () => {
    const variants = [makeVariant('swr', [scoringVersionParam('3')])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: 3 });
  });

  it('returns null for a variant with no scoringVersion parameter at all', () => {
    const variants = [makeVariant('swr', [{ name: 'timeLimit', value: 60 }])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: null });
  });

  it('returns null for a variant with an empty parameters array', () => {
    const variants = [makeVariant('swr', [])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: null });
  });

  it('returns null when parameters is missing entirely from the variant', () => {
    const variants = [{ taskSlug: 'swr' }];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: null });
  });

  it('returns null for a non-integer (fractional) scoringVersion value instead of coercing it', () => {
    const variants = [makeVariant('swr', [scoringVersionParam(1.5)])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: null });
  });

  it('returns null for a non-numeric scoringVersion value', () => {
    const variants = [makeVariant('swr', [scoringVersionParam('not-a-number')])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: null });
  });

  it('coerces a null scoringVersion value to 0 (Number(null) === 0), matching the backend extractScoringVersions', () => {
    const variants = [makeVariant('swr', [scoringVersionParam(null)])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: 0 });
  });

  it('treats scoringVersion 0 as a valid version, not "unknown"', () => {
    const variants = [makeVariant('letter', [scoringVersionParam(0)])];
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value.letter).toBe(0);
    expect(getScoringVersions.value.letter).not.toBeNull();
  });

  it('is reactive to changes in the source ref', async () => {
    const variants = ref([makeVariant('swr', [scoringVersionParam(1)])]);
    const { getScoringVersions } = useScoringVersions(variants);
    expect(getScoringVersions.value).toEqual({ swr: 1 });

    variants.value = [makeVariant('swr', [scoringVersionParam(2)]), makeVariant('sre', [scoringVersionParam(1)])];
    await nextTick();

    expect(getScoringVersions.value).toEqual({ swr: 2, sre: 1 });
  });
});
