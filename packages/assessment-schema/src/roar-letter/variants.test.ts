import { describe, it, expect } from 'vitest';
import { resolveTaskId } from './variants.js';
import { LETTER_TASK_IDS, PHONICS_TASK_IDS } from './config.js';

describe('resolveTaskId', () => {
  it('returns PHONICS_TASK_IDS.EN for phonics task', () => {
    expect(resolveTaskId('phonics', 'en')).toBe(PHONICS_TASK_IDS.EN);
  });

  it('returns LETTER_TASK_IDS.EN for English letter', () => {
    expect(resolveTaskId('letter', 'en')).toBe(LETTER_TASK_IDS.EN);
  });

  it('returns LETTER_TASK_IDS.ES for Spanish letter', () => {
    expect(resolveTaskId('letter', 'es')).toBe(LETTER_TASK_IDS.ES);
  });

  it('returns LETTER_TASK_IDS.EN_CA for Canadian English (lowercase)', () => {
    expect(resolveTaskId('letter', 'en-ca')).toBe(LETTER_TASK_IDS.EN_CA);
  });

  it('returns LETTER_TASK_IDS.EN_CA for Canadian English (i18next uppercase)', () => {
    expect(resolveTaskId('letter', 'en-CA')).toBe(LETTER_TASK_IDS.EN_CA);
  });

  it('falls back to LETTER_TASK_IDS.EN for unknown language', () => {
    expect(resolveTaskId('letter', 'it')).toBe(LETTER_TASK_IDS.EN);
    expect(resolveTaskId('letter', 'fr')).toBe(LETTER_TASK_IDS.EN);
  });
});
