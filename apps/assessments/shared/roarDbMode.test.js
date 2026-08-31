import { describe, it, expect } from 'vitest';
import { ROAR_DB_MODE, unresolvedDefaultVariantPolicy } from './roarDbMode';

describe('unresolvedDefaultVariantPolicy', () => {
  it('is lenient in local development', () => {
    expect(unresolvedDefaultVariantPolicy(ROAR_DB_MODE.DEVELOPMENT)).toBe(
      'fallback',
    );
  });

  it('is strict in staging, which is the pre-production check', () => {
    expect(unresolvedDefaultVariantPolicy(ROAR_DB_MODE.STAGING)).toBe('throw');
  });

  it('is strict in production', () => {
    expect(unresolvedDefaultVariantPolicy(ROAR_DB_MODE.PRODUCTION)).toBe(
      'throw',
    );
  });

  it('defaults to strict for an unrecognised mode', () => {
    // A build misconfigured to an unknown dbmode should fail loudly on an unresolved
    // default rather than quietly running whichever variant happens to be oldest.
    expect(unresolvedDefaultVariantPolicy(undefined)).toBe('throw');
    expect(unresolvedDefaultVariantPolicy('')).toBe('throw');
  });
});
