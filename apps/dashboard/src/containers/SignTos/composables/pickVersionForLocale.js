const FALLBACK_LOCALE = 'en-US';

/**
 * Pick the agreement version that best matches the user's current locale.
 *
 * Match order:
 *   1. Exact match against `i18n.global.locale.value` (e.g., `en-US` ↔ `en-US`).
 *   2. Language-only match (e.g., `es` matches `es-CO` when the user is set to `es`).
 *   3. Fallback to `en-US`.
 *   4. First available version as a last resort (shouldn't happen in practice
 *      because the backend guarantees at least one variant).
 *
 * Tolerates undefined/null `currentLocale` — falls straight through to the
 * en-US fallback rather than throwing on the `.split('-')`. Production never
 * hits that path (`useI18n().locale.value` is always set) but it keeps the
 * helper safe for direct unit-test invocation.
 *
 * @param {Array<{ versionId: string, locale: string }>} versions
 * @param {string} currentLocale
 * @returns {{ versionId: string, locale: string } | null}
 */
export function pickVersionForLocale(versions, currentLocale) {
  if (!Array.isArray(versions) || versions.length === 0) return null;

  const safeLocale = typeof currentLocale === 'string' ? currentLocale : '';

  const exact = versions.find((v) => v.locale === safeLocale);
  if (exact) return exact;

  const languageOnly = safeLocale.split('-')[0];
  if (languageOnly) {
    const langMatch = versions.find((v) => v.locale.split('-')[0] === languageOnly);
    if (langMatch) return langMatch;
  }

  const fallback = versions.find((v) => v.locale === FALLBACK_LOCALE);
  if (fallback) return fallback;

  return versions[0];
}
