import { logger } from '../../logger';

const DEFAULT_ORIGIN = 'https://localhost:5173';

/**
 * Parses a comma-separated ALLOWED_ORIGINS string into a deduplicated array of origin strings.
 *
 * Trims whitespace, filters empty entries, and deduplicates via Set.
 * Falls back to the default development origin if the input is unset, empty, or whitespace-only.
 *
 * @param raw - The raw ALLOWED_ORIGINS environment variable value
 * @returns Array of allowed origin strings
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
    logger.warn({ defaultOrigin: DEFAULT_ORIGIN }, 'ALLOWED_ORIGINS is not set or empty, falling back to default');
    return [DEFAULT_ORIGIN];
  }

  return origins;
}
