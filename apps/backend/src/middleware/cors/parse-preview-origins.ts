import { logger } from '../../logger';

/**
 * Bare Firebase Hosting site ID: lowercase alphanumerics in hyphen-separated
 * groups, with no leading, trailing, or consecutive hyphens.
 *
 * Consecutive hyphens are rejected because `--` separates the site from the
 * channel in a preview URL. An entry containing it is a pasted preview *host*,
 * not a site ID, and would otherwise be interpolated into a pattern matching
 * `site--channel--<anything>.web.app`.
 *
 * Deliberately strict. The infrastructure that sets this variable validates the
 * same shape on write, but the value still arrives as untrusted input here, and
 * anything richer than a site ID signals a misconfiguration rather than a site
 * worth trusting.
 */
const SITE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Builds the anchored preview-origin pattern for a single Hosting site.
 *
 * Firebase preview channel URLs take the form
 * `https://{site}--{channel}-{hash}.web.app`.
 *
 * Two properties of this pattern are load-bearing:
 *
 * - **The site ID is a literal prefix.** `.web.app` is open registration, so a
 *   pattern that wildcarded the site portion would grant credentialed
 *   cross-origin access to any Firebase user on the internet.
 * - **The channel segment is generic.** Channel IDs are chosen by CI — currently
 *   the FirebaseExtended action's `pr<N>-<branch>` default — and Firebase
 *   truncates them to fit the DNS label, so matching anything more specific
 *   would break the moment that naming changed.
 *
 * The `^` and `$` anchors are what stop `…web.app.attacker.com` from matching;
 * the `cors` package tests these with `RegExp.test()` against the caller's
 * Origin header, so an unanchored pattern would be a silent CORS bypass.
 */
const previewOriginPattern = (siteId: string): RegExp => new RegExp(`^https://${siteId}--[a-z0-9-]+\\.web\\.app$`);

/**
 * Parses a comma-separated list of Firebase Hosting site IDs into anchored
 * preview-channel origin patterns.
 *
 * The environment variable carries **bare site IDs** — no scheme, no domain, no
 * `--` suffix — and this module owns the URL convention. Infrastructure
 * deliberately does not ship regexes: a site ID can be validated exhaustively,
 * whereas whether a supplied pattern is too permissive cannot be, and compiling
 * config into matchers would make any future bad value a CORS bypass.
 *
 * Unlike {@link parseAllowedOrigins}, an unset or empty value is **not** an
 * error. Preview channels are a staging-only affordance and the variable is
 * absent in production by design, so absence is the expected state everywhere
 * the allowlist is not in use.
 *
 * @param raw - The raw ALLOWED_FIREBASE_ASSESSMENT_PREVIEW_SITES value
 * @returns Anchored origin patterns, one per valid site ID; empty when unset
 */
export function parsePreviewOrigins(raw: string | undefined): RegExp[] {
  const entries = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  if (entries.length === 0) {
    return [];
  }

  const siteIds = entries.filter((entry) => SITE_ID_PATTERN.test(entry));
  const rejected = entries.filter((entry) => !SITE_ID_PATTERN.test(entry));

  // Skip rather than throw: one malformed entry must not take the service down,
  // and dropping it fails closed — the origin simply is not trusted. Logged at
  // warn because it means the allowlist is narrower than whoever configured it
  // intended, which is otherwise invisible until a preview is refused.
  if (rejected.length > 0) {
    logger.warn(
      { rejected },
      'Ignoring malformed ALLOWED_FIREBASE_ASSESSMENT_PREVIEW_SITES entries; expected bare Firebase Hosting site IDs',
    );
  }

  return siteIds.map(previewOriginPattern);
}
