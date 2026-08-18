import { describe, it, expect } from 'vitest';
import { isPreviewOriginEntry, toPreviewOriginPattern } from './parse-preview-origins';

const SITE = 'gse-roar-admin-staging-word';
const ENTRY = `https://${SITE}--*.web.app`;

/** The pattern under test, built from a well-formed entry. */
const pattern = toPreviewOriginPattern(ENTRY)!;

/** Mirrors how `cors` matches: RegExp.test against the caller's Origin header. */
const allows = (origin: string): boolean => pattern.test(origin);

describe('isPreviewOriginEntry', () => {
  it('treats an entry carrying a wildcard as a preview entry', () => {
    expect(isPreviewOriginEntry(ENTRY)).toBe(true);
  });

  // Classification is by wildcard presence, not by the full grammar, so a
  // malformed attempt is reported as a bad preview entry rather than silently
  // registered as a literal origin that could never match.
  it('treats a malformed wildcard entry as a preview entry', () => {
    expect(isPreviewOriginEntry(`https://${SITE}--pr*.web.app`)).toBe(true);
  });

  it('treats an ordinary origin as a literal', () => {
    expect(isPreviewOriginEntry(`https://${SITE}.web.app`)).toBe(false);
    expect(isPreviewOriginEntry('https://roar.education')).toBe(false);
  });
});

describe('toPreviewOriginPattern', () => {
  describe('accepted form', () => {
    it('builds a pattern from the wildcard form', () => {
      expect(toPreviewOriginPattern(ENTRY)).toBeInstanceOf(RegExp);
    });

    it('matches a preview URL produced by the CI default channel naming', () => {
      expect(allows(`https://${SITE}--pr123-fix-some-thing-a1b2c3d4.web.app`)).toBe(true);
    });

    it('matches a short channel segment', () => {
      expect(allows(`https://${SITE}--x.web.app`)).toBe(true);
    });

    it('matches regardless of channel naming scheme', () => {
      expect(allows(`https://${SITE}--release-2026-08-12-9f8e7d6c.web.app`)).toBe(true);
    });
  });

  describe('rejects origins that must not be trusted', () => {
    // Anchor regression: without a trailing $, an attacker-controlled parent
    // domain would match and CORS would be silently bypassed.
    it('rejects a suffixed attacker domain', () => {
      expect(allows(`https://${SITE}--x.web.app.evil.com`)).toBe(false);
    });

    // Prefix regression: without a leading ^, any host ending in the pattern matches.
    it('rejects an attacker-controlled prefix', () => {
      expect(allows(`https://evil.com/https://${SITE}--x.web.app`)).toBe(false);
    });

    // The site ID must stay a literal — .web.app is open registration, so a
    // wildcarded site portion would trust any Firebase user on the internet.
    it('rejects a different site', () => {
      expect(allows('https://evil-site--x.web.app')).toBe(false);
    });

    it('rejects a site that merely starts with the allowed ID', () => {
      expect(allows(`https://${SITE}-evil--x.web.app`)).toBe(false);
    });

    it('rejects the live origin, which needs its own literal entry', () => {
      expect(allows(`https://${SITE}.web.app`)).toBe(false);
    });

    it('rejects a missing channel segment', () => {
      expect(allows(`https://${SITE}--.web.app`)).toBe(false);
    });

    it('rejects an uppercase channel segment', () => {
      expect(allows(`https://${SITE}--PR1.web.app`)).toBe(false);
    });

    it('rejects a non-web.app domain', () => {
      expect(allows(`https://${SITE}--x.firebaseapp.com`)).toBe(false);
    });

    it('rejects plaintext http', () => {
      expect(allows(`http://${SITE}--x.web.app`)).toBe(false);
    });

    // The dot before web.app is escaped; an unescaped one would match any character.
    it('rejects a substituted separator before web.app', () => {
      expect(allows(`https://${SITE}--xXweb.app`)).toBe(false);
    });

    // The literal "*" is a config marker, never part of the compiled pattern, so
    // it must not match an Origin header either.
    it('rejects the configured entry itself as an origin', () => {
      expect(allows(ENTRY)).toBe(false);
    });
  });

  // Mirrors the rejection table for VALID_PREVIEW_ORIGIN_PATTERN in roar-iac. The
  // two grammars are kept identical on purpose: were this one stricter, an entry
  // could pass validation at plan time and then be dropped here, narrowing the
  // allowlist with nothing to show for it until a preview request was refused.
  describe('rejected entry forms', () => {
    it.each([
      ['a bare wildcard host', 'https://*.web.app'],
      ['a wildcard subdomain', 'https://*.roar.education'],
      ['a wildcard inside the site ID', 'https://gse-roar-*-word--*.web.app'],
      ['a wildcard channel on a non-Firebase domain', 'https://word--*.roar.education'],
      ['a wildcard suffix rather than a channel', `https://${SITE}*.web.app`],
      ['a partial channel wildcard', `https://${SITE}--pr*.web.app`],
      ['a doubled wildcard', `https://${SITE}--*--*.web.app`],
      ['an uppercase site', `https://GSE-roar-admin-word--*.web.app`],
      ['a bare site ID', SITE],
      ['a literal origin', `https://${SITE}.web.app`],
      ['plaintext http', `http://${SITE}--*.web.app`],
      ['a trailing slash', `https://${SITE}--*.web.app/`],
      ['regex metacharacters', '.*'],
    ])('returns null for %s', (_shape, entry) => {
      expect(toPreviewOriginPattern(entry)).toBeNull();
    });
  });
});
