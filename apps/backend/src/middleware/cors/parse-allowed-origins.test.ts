import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '../../logger';
import { parseAllowedOrigins } from './parse-allowed-origins';

const SITE = 'gse-roar-admin-staging-word';
const PREVIEW_ENTRY = `https://${SITE}--*.web.app`;

describe('parseAllowedOrigins', () => {
  it('parses comma-separated origins', () => {
    const result = parseAllowedOrigins('https://a.com,https://b.com');
    expect(result.origins).toEqual(['https://a.com', 'https://b.com']);
    expect(result.previewPatterns).toEqual([]);
  });

  it('trims whitespace around origins', () => {
    expect(parseAllowedOrigins('  https://a.com , https://b.com  ').origins).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('deduplicates origins', () => {
    expect(parseAllowedOrigins('https://a.com,https://a.com,https://b.com').origins).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('filters empty entries from trailing commas', () => {
    expect(parseAllowedOrigins('https://a.com,,,https://b.com,').origins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('handles a single origin', () => {
    expect(parseAllowedOrigins('https://a.com').origins).toEqual(['https://a.com']);
  });

  // Every entry is classified exactly once, so none can be both matched literally
  // and compiled into a pattern, nor fall between the two and be dropped.
  describe('splitting literal from preview entries', () => {
    it('routes a preview entry to a pattern and keeps it out of the literals', () => {
      const result = parseAllowedOrigins(`https://roar.education,${PREVIEW_ENTRY}`);
      expect(result.origins).toEqual(['https://roar.education']);
      expect(result.previewPatterns).toHaveLength(1);
      expect(result.previewPatterns[0]!.test(`https://${SITE}--pr1-abc.web.app`)).toBe(true);
    });

    it('keeps a site live origin literal and its preview form as a pattern', () => {
      const result = parseAllowedOrigins(`https://${SITE}.web.app,${PREVIEW_ENTRY}`);
      expect(result.origins).toEqual([`https://${SITE}.web.app`]);
      expect(result.previewPatterns).toHaveLength(1);
    });

    it('handles an allowlist of preview entries only', () => {
      const result = parseAllowedOrigins(PREVIEW_ENTRY);
      expect(result.origins).toEqual([]);
      expect(result.previewPatterns).toHaveLength(1);
    });

    it('builds one pattern per preview entry', () => {
      const result = parseAllowedOrigins(`${PREVIEW_ENTRY},https://gse-roar-admin-staging-math--*.web.app`);
      expect(result.previewPatterns).toHaveLength(2);
    });

    it('deduplicates repeated preview entries', () => {
      expect(parseAllowedOrigins(`${PREVIEW_ENTRY},${PREVIEW_ENTRY}`).previewPatterns).toHaveLength(1);
    });
  });

  // Skipping fails closed: the origin is not trusted. A malformed preview entry
  // could not have matched as a literal either, since no browser sends an Origin
  // containing "*" — so dropping it loses nothing but must be visible.
  describe('malformed preview entries', () => {
    it('skips a malformed wildcard entry rather than treating it as a literal', () => {
      const result = parseAllowedOrigins(`https://${SITE}--pr*.web.app`);
      expect(result.origins).toEqual([]);
      expect(result.previewPatterns).toEqual([]);
    });

    it('keeps valid entries alongside malformed ones', () => {
      const result = parseAllowedOrigins(`https://roar.education,https://*.web.app,${PREVIEW_ENTRY}`);
      expect(result.origins).toEqual(['https://roar.education']);
      expect(result.previewPatterns).toHaveLength(1);
    });

    it('warns so a silently narrowed allowlist is visible', () => {
      parseAllowedOrigins(`https://roar.education,https://*.web.app`);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('does not warn when every entry is valid', () => {
      parseAllowedOrigins(`https://roar.education,${PREVIEW_ENTRY}`);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('fallback to default', () => {
    it('falls back when undefined', () => {
      const result = parseAllowedOrigins(undefined);
      expect(result.origins).toEqual(['https://localhost:5173']);
      expect(result.previewPatterns).toEqual([]);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back when empty string', () => {
      expect(parseAllowedOrigins('').origins).toEqual(['https://localhost:5173']);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('falls back when whitespace-only', () => {
      expect(parseAllowedOrigins('   ,  ,  ').origins).toEqual(['https://localhost:5173']);
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  it('does not log a warning when origins are provided', () => {
    parseAllowedOrigins('https://a.com');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  describe('production', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('throws when ALLOWED_ORIGINS is unset or empty in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => parseAllowedOrigins(undefined)).toThrow(/ALLOWED_ORIGINS/);
      expect(() => parseAllowedOrigins('   ,  ,  ')).toThrow(/ALLOWED_ORIGINS/);
    });

    it('still returns provided origins in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(parseAllowedOrigins('https://app.example.com').origins).toEqual(['https://app.example.com']);
    });

    // NODE_ENV is "production" on the staging service too, so this module cannot
    // gate previews on it — doing so would disable them in staging, the only place
    // they are meant to work. roar-iac rejects the wildcard form for the prod stack
    // at plan time instead. This pins the deliberate absence of a gate here, so
    // adding one is a conscious decision rather than a plausible-looking fix.
    it('does not drop preview entries when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(parseAllowedOrigins(PREVIEW_ENTRY).previewPatterns).toHaveLength(1);
    });
  });
});
