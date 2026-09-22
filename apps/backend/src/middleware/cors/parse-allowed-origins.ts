import { logger } from '../../logger';
import { isPreviewOriginEntry, toPreviewOriginPatterns } from './parse-preview-origins';

const DEFAULT_ORIGIN = 'https://localhost:5173';

/**
 * The `null` origin, which browsers send from sandboxed iframes, `data:` URLs, and
 * some redirect chains. Never a legitimate ROAR caller, and with `credentials: true`
 * trusting it would let any such context make authenticated cross-origin requests.
 *
 * roar-iac's origin pattern already rejects it at plan time. Repeating the check here
 * costs nothing and is the right layer for it: unlike the production preview gate,
 * this is a property of the value rather than a per-stack policy, so it holds for
 * every caller in every environment.
 */
const NULL_ORIGIN = 'null';

/** The CORS allowlist, split by how each entry has to be matched. */
export interface AllowedOrigins {
  /** Origins matched exactly (the `cors` package compares these with `===`). */
  origins: string[];
  /** Anchored patterns for Firebase preview channels. */
  previewPatterns: RegExp[];
}

/**
 * Parses a comma-separated ALLOWED_ORIGINS string into the exact origins and the
 * preview-channel patterns the CORS middleware should trust.
 *
 * Trims whitespace, filters empty entries, and deduplicates via Set.
 *
 * Every entry is classified exactly once, here, so an entry cannot be both
 * matched literally and compiled into a pattern, nor fall between the two and be
 * dropped unnoticed:
 *
 * - Entries carrying a `*` are preview origins. Well-formed ones become anchored
 *   patterns; malformed ones are skipped with a warning. Skipping fails closed —
 *   the origin is simply not trusted — and a malformed preview entry could never
 *   have matched as a literal anyway, since no browser sends an Origin
 *   containing `*`.
 * - Everything else is matched exactly, unchanged.
 *
 * When the value is unset, empty, or whitespace-only:
 * - In production, throws — a deployed environment must declare its allowlist explicitly, so a
 *   misconfiguration fails the boot loudly instead of silently shipping a dev-only origin.
 * - Otherwise, falls back to the local development origin and logs a warning.
 *
 * Note that preview origins are *not* gated on NODE_ENV here. The Cloud Run
 * module sets `NODE_ENV=production` on the staging and production services
 * alike, and no other environment discriminator reaches this container, so such
 * a check would disable previews in staging — the only place they are meant to
 * work — while every test in this repo still passed. Keeping preview origins out
 * of production is enforced where the environment is actually known: roar-iac
 * rejects the wildcard form for the prod stack at plan time.
 *
 * @param raw - The raw ALLOWED_ORIGINS environment variable value
 * @returns Exact origins and preview-channel patterns
 * @throws {Error} If ALLOWED_ORIGINS is unset or empty while NODE_ENV is 'production'
 */
export function parseAllowedOrigins(raw: string | undefined): AllowedOrigins {
  const entries = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  if (entries.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ALLOWED_ORIGINS must be set in production');
    }
    logger.warn({ defaultOrigin: DEFAULT_ORIGIN }, 'ALLOWED_ORIGINS is not set or empty, falling back to default');
    return { origins: [DEFAULT_ORIGIN], previewPatterns: [] };
  }

  const origins: string[] = [];
  const previewEntries: string[] = [];
  const nullOrigins: string[] = [];

  for (const entry of entries) {
    if (entry.toLowerCase() === NULL_ORIGIN) {
      nullOrigins.push(entry);
    } else if (isPreviewOriginEntry(entry)) {
      previewEntries.push(entry);
    } else {
      origins.push(entry);
    }
  }

  const { patterns: previewPatterns, rejected: malformedPreviews } = toPreviewOriginPatterns(previewEntries);

  // Warn rather than throw: one bad entry must not take the service down. Logged
  // because the allowlist is now narrower than whoever configured it intended,
  // which is otherwise invisible until a request is refused.
  if (malformedPreviews.length > 0) {
    logger.warn(
      { rejected: malformedPreviews },
      'Ignoring malformed ALLOWED_ORIGINS preview entries; expected the form https://<site>--*.web.app',
    );
  }

  // Separate warning: this one is a security-relevant value rather than a typo.
  if (nullOrigins.length > 0) {
    logger.warn(
      { rejected: nullOrigins },
      'Refusing to trust the "null" origin from ALLOWED_ORIGINS; it is sent by sandboxed iframes and data: URLs',
    );
  }

  return { origins, previewPatterns };
}
