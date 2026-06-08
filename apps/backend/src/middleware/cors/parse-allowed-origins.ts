import { logger } from '../../logger';

const DEFAULT_ORIGIN = 'https://localhost:5173';

/**
 * Parses a comma-separated ALLOWED_ORIGINS string into a deduplicated array of origin strings.
 *
 * Trims whitespace, filters empty entries, and deduplicates via Set.
 *
 * When the value is unset, empty, or whitespace-only:
 * - In production, throws — a deployed environment must declare its allowlist explicitly, so a
 *   misconfiguration fails the boot loudly instead of silently shipping a dev-only origin.
 * - Otherwise, falls back to the local development origin and logs a warning.
 *
 * @param raw - The raw ALLOWED_ORIGINS environment variable value
 * @returns Array of allowed origin strings
 * @throws {Error} If ALLOWED_ORIGINS is unset or empty while NODE_ENV is 'production'
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  const origins = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  if (origins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ALLOWED_ORIGINS must be set in production');
    }
    logger.warn({ defaultOrigin: DEFAULT_ORIGIN }, 'ALLOWED_ORIGINS is not set or empty, falling back to default');
    return [DEFAULT_ORIGIN];
  }

  return origins;
}
