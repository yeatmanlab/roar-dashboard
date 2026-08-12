import { describe, it, expect } from 'vitest';
import { logger } from '../../logger';
import { parsePreviewOrigins } from './parse-preview-origins';

const SITE = 'gse-roar-admin-staging-word';

/** True when any produced pattern accepts the origin, mirroring how `cors` matches. */
const allows = (patterns: RegExp[], origin: string): boolean => patterns.some((p) => p.test(origin));

describe('parsePreviewOrigins', () => {
  describe('parsing', () => {
    it('parses a single site ID', () => {
      expect(parsePreviewOrigins(SITE)).toHaveLength(1);
    });

    it('parses comma-separated site IDs', () => {
      expect(parsePreviewOrigins(`${SITE},gse-roar-admin-staging-math`)).toHaveLength(2);
    });

    it('trims whitespace around entries', () => {
      const patterns = parsePreviewOrigins(`  ${SITE} , gse-roar-admin-staging-math  `);
      expect(patterns).toHaveLength(2);
      expect(allows(patterns, `https://${SITE}--pr1-a1b2c3d4.web.app`)).toBe(true);
    });

    it('deduplicates repeated site IDs', () => {
      expect(parsePreviewOrigins(`${SITE},${SITE}`)).toHaveLength(1);
    });

    it('filters empty entries from trailing commas', () => {
      expect(parsePreviewOrigins(`${SITE},,,gse-roar-admin-staging-math,`)).toHaveLength(2);
    });
  });

  // Absence is the correct production state, so unlike parseAllowedOrigins this
  // must never throw and must never fall back to a default.
  describe('empty input', () => {
    it('returns an empty array when undefined', () => {
      expect(parsePreviewOrigins(undefined)).toEqual([]);
    });

    it('returns an empty array when empty', () => {
      expect(parsePreviewOrigins('')).toEqual([]);
    });

    it('returns an empty array when whitespace-only', () => {
      expect(parsePreviewOrigins('   ,  ,  ')).toEqual([]);
    });

    it('does not throw in production when unset', () => {
      expect(() => parsePreviewOrigins(undefined)).not.toThrow();
    });
  });

  describe('matching', () => {
    const patterns = parsePreviewOrigins(SITE);

    it('matches a preview URL produced by the CI default channel naming', () => {
      expect(allows(patterns, `https://${SITE}--pr123-fix-some-thing-a1b2c3d4.web.app`)).toBe(true);
    });

    it('matches a short channel segment', () => {
      expect(allows(patterns, `https://${SITE}--x.web.app`)).toBe(true);
    });

    it('matches regardless of channel naming scheme', () => {
      expect(allows(patterns, `https://${SITE}--release-2026-08-12-9f8e7d6c.web.app`)).toBe(true);
    });
  });

  describe('rejects origins that must not be trusted', () => {
    const patterns = parsePreviewOrigins(SITE);

    // Anchor regression: without a trailing $, an attacker-controlled parent
    // domain would match and CORS would be silently bypassed.
    it('rejects a suffixed attacker domain', () => {
      expect(allows(patterns, `https://${SITE}--x.web.app.evil.com`)).toBe(false);
    });

    // Prefix regression: without a leading ^, any host ending in the pattern matches.
    it('rejects an attacker-controlled prefix', () => {
      expect(allows(patterns, `https://evil.com/https://${SITE}--x.web.app`)).toBe(false);
    });

    // The site ID must stay a literal — .web.app is open registration, so a
    // wildcarded site portion would trust any Firebase user on the internet.
    it('rejects a different site', () => {
      expect(allows(patterns, 'https://evil-site--x.web.app')).toBe(false);
    });

    it('rejects a site that merely starts with the allowed ID', () => {
      expect(allows(patterns, `https://${SITE}-evil--x.web.app`)).toBe(false);
    });

    it('rejects the live origin, which belongs in ALLOWED_ORIGINS', () => {
      expect(allows(patterns, `https://${SITE}.web.app`)).toBe(false);
    });

    it('rejects a missing channel segment', () => {
      expect(allows(patterns, `https://${SITE}--.web.app`)).toBe(false);
    });

    it('rejects an uppercase channel segment', () => {
      expect(allows(patterns, `https://${SITE}--PR1.web.app`)).toBe(false);
    });

    it('rejects a non-web.app domain', () => {
      expect(allows(patterns, `https://${SITE}--x.firebaseapp.com`)).toBe(false);
    });

    it('rejects plaintext http', () => {
      expect(allows(patterns, `http://${SITE}--x.web.app`)).toBe(false);
    });

    // The dot before web.app is escaped; an unescaped one would match any character.
    it('rejects a substituted separator before web.app', () => {
      expect(allows(patterns, `https://${SITE}--xXweb.app`)).toBe(false);
    });
  });

  describe('malformed entries', () => {
    it('skips an entry carrying a scheme', () => {
      expect(parsePreviewOrigins(`https://${SITE}`)).toEqual([]);
    });

    it('skips an entry carrying a domain', () => {
      expect(parsePreviewOrigins(`${SITE}.web.app`)).toEqual([]);
    });

    it('skips an entry carrying a preview suffix', () => {
      expect(parsePreviewOrigins(`${SITE}--pr1-abc`)).toEqual([]);
    });

    it('skips an entry with regex metacharacters rather than compiling them', () => {
      expect(parsePreviewOrigins('.*')).toEqual([]);
      expect(parsePreviewOrigins('gse-roar.*')).toEqual([]);
    });

    it('keeps valid entries alongside malformed ones', () => {
      const patterns = parsePreviewOrigins(`${SITE},not a site id,gse-roar-admin-staging-math`);
      expect(patterns).toHaveLength(2);
      expect(allows(patterns, `https://${SITE}--x.web.app`)).toBe(true);
    });

    it('warns so a silently narrowed allowlist is visible', () => {
      parsePreviewOrigins(`${SITE},https://evil.com`);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('does not warn when every entry is valid', () => {
      parsePreviewOrigins(SITE);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
