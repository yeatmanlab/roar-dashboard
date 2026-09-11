import { UnresolvedDefault } from '@roar-platform/assessment-sdk';

/**
 * The three values a standalone build's `ROAR_DB` global can take, injected per build by
 * webpack's `DefinePlugin` (`--env dbmode=...`).
 *
 * Declared here so the ten `serve.js` harnesses compare against a constant rather than
 * repeating string literals. Nothing in this module reads `ROAR_DB` itself — shared/ is
 * deliberately free of build-time globals (see this directory's eslint config), so callers
 * pass the mode in.
 */
export const ROAR_DB_MODE = Object.freeze({
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
});

/**
 * Whether a build should honour a declared default variant strictly.
 *
 * Strict everywhere but local development. In staging and production a declared default that
 * does not resolve is a real problem — a typo or a renamed variant would otherwise silently
 * run a different configuration — and staging strictness is the pre-production check. Local
 * development is lenient because a researcher's own seed need not contain the canonical
 * variant for the assessment they are working on.
 *
 * @param {string} dbMode - The build's `ROAR_DB` value; compare against {@link ROAR_DB_MODE}
 * @returns {'throw' | 'fallback'} The `onUnresolvedDefault` policy to pass to
 *   `bootstrapAnonymousSession`
 */
export function unresolvedDefaultVariantPolicy(dbMode) {
  return dbMode === ROAR_DB_MODE.DEVELOPMENT ? UnresolvedDefault.FALLBACK : UnresolvedDefault.THROW;
}
