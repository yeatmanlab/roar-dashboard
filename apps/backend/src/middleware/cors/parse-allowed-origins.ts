import { logger } from '../../logger';
import { isPreviewOriginEntry, toPreviewOriginPattern } from './parse-preview-origins';

const DEFAULT_ORIGIN = 'https://localhost:5173';

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
  const previewPatterns: RegExp[] = [];
  const rejected: string[] = [];

  for (const entry of entries) {
    if (!isPreviewOriginEntry(entry)) {
      origins.push(entry);
      continue;
    }
    const pattern = toPreviewOriginPattern(entry);
    if (pattern) {
      previewPatterns.push(pattern);
    } else {
      rejected.push(entry);
    }
  }

  // Warn rather than throw: one malformed entry must not take the service down.
  // Logged because the allowlist is now narrower than whoever configured it
  // intended, which is otherwise invisible until a preview request is refused.
  if (rejected.length > 0) {
    logger.warn(
      { rejected },
      'Ignoring malformed ALLOWED_ORIGINS preview entries; expected the form https://<site>--*.web.app',
    );
  }

  return { origins, previewPatterns };
}
