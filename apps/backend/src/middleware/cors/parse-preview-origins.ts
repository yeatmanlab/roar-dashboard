/**
 * Firebase Hosting preview-channel origin, as written in ALLOWED_ORIGINS:
 *
 *   https://gse-roar-admin-word--*.web.app
 *
 * The `*` stands in for the channel segment and may appear nowhere else. This
 * mirrors `VALID_PREVIEW_ORIGIN_PATTERN` in roar-iac
 * (`infra/services/backend-api/constants.ts`) **exactly**, and deliberately so:
 * if the two grammars disagreed, an entry could pass validation at plan time and
 * then be dropped here, silently narrowing the allowlist in a way nothing
 * surfaces until a preview request is refused.
 *
 * The site ID is captured so it can be interpolated into the anchored matcher
 * below. Because the grammar admits only lowercase alphanumerics and hyphens,
 * the captured value cannot carry regex metacharacters — validating before
 * interpolating is what makes the `new RegExp()` call safe.
 */
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)--\*\.web\.app$/;

/**
 * Escapes regex metacharacters so an interpolated value is matched literally.
 *
 * Unreachable today by construction: {@link PREVIEW_ORIGIN_PATTERN} captures only
 * lowercase alphanumerics and hyphens, none of which are metacharacters. It is
 * here so the safety of the `new RegExp()` below is a property of that call
 * rather than of a grammar three lines away — if the capture group is ever
 * widened, a configured origin cannot become a pattern.
 */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when an entry is *intended* as a preview origin, whether or not it is
 * well-formed.
 *
 * Classification is by the presence of a wildcard rather than by the full
 * grammar, so that a malformed attempt (`https://site--pr*.web.app`) is reported
 * as a bad preview entry instead of falling through and being registered as a
 * literal origin that could never match anything.
 */
export function isPreviewOriginEntry(entry: string): boolean {
  return entry.includes('*');
}

/** Preview entries sorted into compiled matchers and the ones that failed the grammar. */
export interface PreviewOriginPatterns {
  patterns: RegExp[];
  rejected: string[];
}

/**
 * Converts preview-origin entries into anchored matchers, reporting any that do
 * not satisfy the grammar.
 *
 * Takes and returns collections rather than converting one entry to
 * `RegExp | null`. The nullable shape read fine, but it meant a `null` was
 * produced in the same expression that feeds the CORS `origin` option, and a
 * `null` origin is itself a recognised CORS hazard — so static analysis could not
 * tell the two apart, and neither could a reader skimming the call site. Here no
 * null is ever created: an entry either contributes a pattern or a rejection.
 *
 * Firebase preview channel URLs take the form
 * `https://{site}--{channel}-{hash}.web.app`.
 *
 * Three properties of the produced patterns are load-bearing:
 *
 * - **The site ID is a literal prefix.** `.web.app` is open registration, so a
 *   pattern that wildcarded the site portion would grant credentialed
 *   cross-origin access to any Firebase user on the internet.
 * - **The channel segment is generic.** Channel IDs are chosen by CI — currently
 *   the FirebaseExtended action's `pr<N>-<branch>` default — and Firebase
 *   truncates them to fit the DNS label, so matching anything more specific
 *   would break the moment that naming changed.
 * - **They are anchored.** `^`/`$` are what stop `…web.app.attacker.com` from
 *   matching; the `cors` package tests these with `RegExp.test()` against the
 *   caller's Origin header, so an unanchored pattern would be a silent bypass.
 *
 * Note the `*` never reaches a compiled pattern: it is a marker in config that
 * this function replaces with an explicit character class, so no part of the
 * configured value is treated as a regex.
 */
export function toPreviewOriginPatterns(entries: string[]): PreviewOriginPatterns {
  const patterns: RegExp[] = [];
  const rejected: string[] = [];

  for (const entry of entries) {
    const match = PREVIEW_ORIGIN_PATTERN.exec(entry);
    if (match) {
      patterns.push(new RegExp(`^https://${escapeRegExp(match[1]!)}--[a-z0-9-]+\\.web\\.app$`));
    } else {
      rejected.push(entry);
    }
  }

  return { patterns, rejected };
}
