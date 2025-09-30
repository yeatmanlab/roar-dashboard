import { languageOptions } from '@/translations/i18n';

export interface LanguageInfo {
  code: string; // e.g., 'en-US', 'es-CO' (primary) or 'en', 'es' (legacy)
  dashboardLocale: string; // e.g., 'en-US', 'es-CO'
  displayName: string; // e.g., 'English (United States)'
  flagCode: string; // e.g., 'usa', 'col'
  isLegacy: boolean; // true for legacy 'en', 'es' codes
}

export interface VariantLanguageMapping {
  variantCode: string; // Code used in variant params (full locale preferred)
  dashboardLocale: string; // Dashboard locale (same as variantCode for full locales)
  displayName: string; // Display name for UI
  flagCode: string; // Country flag code
  isLegacy: boolean; // true for legacy compatibility codes
}

/**
 * Legacy language mapping for backward compatibility
 * Maps old simplified codes to full locales
 */
const LEGACY_LANGUAGE_MAPPINGS: Record<string, string> = {
  en: 'en-US', // Legacy English → US English
  es: 'es-CO', // Legacy Spanish → Colombian Spanish
};

/**
 * Languages that should be treated as legacy even if they exist in languageOptions
 * These are simple language codes that should map to more specific locales
 */
const FORCE_LEGACY_CODES = ['en', 'es'];

/**
 * Discovers all available languages from the dashboard translation system
 * @returns Array of language information with full locales as primary, legacy codes for compatibility
 */
export function discoverAvailableLanguages(): VariantLanguageMapping[] {
  const languages: VariantLanguageMapping[] = [];

  // Get all available dashboard locales
  const dashboardLocales = Object.keys(languageOptions);

  // First pass: Add full locales as primary variant codes (exclude forced legacy codes)
  dashboardLocales.forEach((locale) => {
    const langInfo = languageOptions[locale];
    if (!langInfo) return;

    // Skip if this should be treated as legacy
    if (FORCE_LEGACY_CODES.includes(locale)) return;

    languages.push({
      variantCode: locale, // Use full locale as variant code
      dashboardLocale: locale, // Same as variant code
      displayName: langInfo.language,
      flagCode: langInfo.code,
      isLegacy: false, // Full locales are not legacy
    });
  });

  // Second pass: Add legacy compatibility mappings
  Object.entries(LEGACY_LANGUAGE_MAPPINGS).forEach(([legacyCode, fullLocale]) => {
    const langInfo = languageOptions[fullLocale];
    if (!langInfo) return;

    // Only add legacy mapping if the full locale exists
    if (dashboardLocales.includes(fullLocale)) {
      languages.push({
        variantCode: legacyCode, // Legacy code (en, es)
        dashboardLocale: fullLocale, // Maps to full locale
        displayName: `${langInfo.language} (legacy)`,
        flagCode: langInfo.code,
        isLegacy: true, // Mark as legacy
      });
    }
  });

  // Third pass: Add any forced legacy codes that exist in languageOptions but map to themselves
  FORCE_LEGACY_CODES.forEach((legacyCode) => {
    const langInfo = languageOptions[legacyCode];
    if (!langInfo) return;

    // Only add if not already covered by legacy mapping
    if (!LEGACY_LANGUAGE_MAPPINGS[legacyCode]) {
      languages.push({
        variantCode: legacyCode,
        dashboardLocale: legacyCode,
        displayName: `${langInfo.language} (legacy)`,
        flagCode: langInfo.code,
        isLegacy: true,
      });
    }
  });

  // Sort: full locales first, then legacy, alphabetically within each group
  return languages.sort((a, b) => {
    if (a.isLegacy !== b.isLegacy) {
      return a.isLegacy ? 1 : -1; // Full locales first
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Gets the dashboard locale for a given variant language code
 * @param variantLanguageCode - The language code used in variants (full locale or legacy code)
 * @returns The corresponding dashboard locale
 */
export function getLocaleForVariantLanguage(variantLanguageCode: string): string {
  // Check if it's a legacy mapping first
  if (LEGACY_LANGUAGE_MAPPINGS[variantLanguageCode]) {
    return LEGACY_LANGUAGE_MAPPINGS[variantLanguageCode];
  }

  // If it's already a full locale and exists in languageOptions, return as-is
  if (languageOptions[variantLanguageCode]) {
    return variantLanguageCode;
  }

  // Fallback: return as-is (might be a custom locale)
  return variantLanguageCode;
}

/**
 * Gets the preferred variant language code for a given dashboard locale
 * @param dashboardLocale - The dashboard locale (e.g., 'en-US', 'es-CO')
 * @returns The preferred variant language code (full locale for new variants)
 */
export function getVariantLanguageForLocale(dashboardLocale: string): string {
  // For full locale system, the variant code IS the dashboard locale
  return dashboardLocale;
}

/**
 * Gets the legacy variant code for a dashboard locale (for backward compatibility)
 * @param dashboardLocale - The dashboard locale
 * @returns The legacy variant code if one exists, otherwise null
 */
export function getLegacyVariantCode(dashboardLocale: string): string | null {
  for (const [legacyCode, fullLocale] of Object.entries(LEGACY_LANGUAGE_MAPPINGS)) {
    if (fullLocale === dashboardLocale) {
      return legacyCode;
    }
  }
  return null;
}

/**
 * Gets language information for a specific variant language code
 * @param variantLanguageCode - The language code used in variants
 * @returns Language information including dashboard locale and display name
 */
export function getLanguageInfo(variantLanguageCode: string): VariantLanguageMapping | null {
  const languages = discoverAvailableLanguages();
  return languages.find((lang) => lang.variantCode === variantLanguageCode) || null;
}

/**
 * Validates if a variant language code is supported
 * @param variantLanguageCode - The language code to validate
 * @returns True if the language is supported
 */
export function isLanguageSupported(variantLanguageCode: string): boolean {
  const languages = discoverAvailableLanguages();
  return languages.some((lang) => lang.variantCode === variantLanguageCode);
}

/**
 * Gets the primary language options for variant creation
 * Returns full locales as primary options, excluding legacy codes
 */
export function getPrimaryLanguageOptions(): VariantLanguageMapping[] {
  const allLanguages = discoverAvailableLanguages();

  // Return only non-legacy languages (full locales)
  return allLanguages.filter((lang) => !lang.isLegacy);
}

/**
 * Gets all language options including legacy for comprehensive compatibility
 */
export function getAllLanguageOptions(): VariantLanguageMapping[] {
  return discoverAvailableLanguages();
}

/**
 * Gets only legacy language options for backward compatibility scenarios
 */
export function getLegacyLanguageOptions(): VariantLanguageMapping[] {
  const allLanguages = discoverAvailableLanguages();
  return allLanguages.filter((lang) => lang.isLegacy);
}
