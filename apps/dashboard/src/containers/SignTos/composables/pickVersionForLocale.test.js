import { describe, it, expect } from 'vitest';
import { pickVersionForLocale } from './pickVersionForLocale';

describe('pickVersionForLocale', () => {
  it('returns the exact-match version when available', () => {
    const versions = [
      { versionId: 'v-en', locale: 'en-US' },
      { versionId: 'v-es', locale: 'es-CO' },
    ];
    expect(pickVersionForLocale(versions, 'es-CO')).toEqual({ versionId: 'v-es', locale: 'es-CO' });
  });

  it('falls back to a language-only match when no exact-locale match exists', () => {
    const versions = [
      { versionId: 'v-en', locale: 'en-US' },
      { versionId: 'v-es-co', locale: 'es-CO' },
    ];
    expect(pickVersionForLocale(versions, 'es')).toEqual({ versionId: 'v-es-co', locale: 'es-CO' });
  });

  it('falls back to en-US when neither exact nor language match exists', () => {
    const versions = [
      { versionId: 'v-en-us', locale: 'en-US' },
      { versionId: 'v-fr', locale: 'fr-FR' },
    ];
    expect(pickVersionForLocale(versions, 'de-DE')).toEqual({ versionId: 'v-en-us', locale: 'en-US' });
  });

  it('returns the first available version when no preferred match exists', () => {
    const versions = [
      { versionId: 'v-fr', locale: 'fr-FR' },
      { versionId: 'v-de', locale: 'de-DE' },
    ];
    expect(pickVersionForLocale(versions, 'ja-JP')).toEqual({ versionId: 'v-fr', locale: 'fr-FR' });
  });

  it('returns null for an empty versions array', () => {
    expect(pickVersionForLocale([], 'en-US')).toBeNull();
  });

  it('returns null for a non-array input', () => {
    expect(pickVersionForLocale(undefined, 'en-US')).toBeNull();
    expect(pickVersionForLocale(null, 'en-US')).toBeNull();
  });

  it('tolerates a missing currentLocale by falling through to en-US', () => {
    const versions = [
      { versionId: 'v-en-us', locale: 'en-US' },
      { versionId: 'v-es', locale: 'es-CO' },
    ];
    expect(pickVersionForLocale(versions, undefined)).toEqual({ versionId: 'v-en-us', locale: 'en-US' });
    expect(pickVersionForLocale(versions, null)).toEqual({ versionId: 'v-en-us', locale: 'en-US' });
  });
});
