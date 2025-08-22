import { describe, it, expect } from 'vitest';
import { 
  getAllLanguageOptions,
  getPrimaryLanguageOptions,
  getLocaleForVariantLanguage, 
  getVariantLanguageForLocale,
  getLanguageInfo,
  isLanguageSupported,
  getLegacyLanguageOptions
} from '../languageDiscovery';

describe('Language Discovery System', () => {
  describe('discoverAvailableLanguages', () => {
    it('should discover languages with full locales as primary', () => {
      const languages = getAllLanguageOptions();
      
      expect(languages).toBeDefined();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      
      // Should include full locale mappings as primary
      const englishUSLang = languages.find(lang => lang.variantCode === 'en-US');
      const spanishCOLang = languages.find(lang => lang.variantCode === 'es-CO');
      
      expect(englishUSLang).toBeDefined();
      expect(spanishCOLang).toBeDefined();
      expect(englishUSLang?.isLegacy).toBe(false);
      expect(spanishCOLang?.isLegacy).toBe(false);
      
      // Should also include legacy mappings for compatibility
      const legacyEnglish = languages.find(lang => lang.variantCode === 'en');
      const legacySpanish = languages.find(lang => lang.variantCode === 'es');
      
      expect(legacyEnglish).toBeDefined();
      expect(legacySpanish).toBeDefined();
      expect(legacyEnglish?.isLegacy).toBe(true);
      expect(legacySpanish?.isLegacy).toBe(true);
      
      // Verify structure includes isLegacy flag
      expect(englishUSLang).toHaveProperty('variantCode');
      expect(englishUSLang).toHaveProperty('dashboardLocale');
      expect(englishUSLang).toHaveProperty('displayName');
      expect(englishUSLang).toHaveProperty('flagCode');
      expect(englishUSLang).toHaveProperty('isLegacy');
    });

    it('should sort full locales before legacy codes', () => {
      const languages = getAllLanguageOptions();
      const fullLocales = languages.filter(lang => !lang.isLegacy);
      const legacyCodes = languages.filter(lang => lang.isLegacy);
      
      expect(fullLocales.length).toBeGreaterThan(0);
      expect(legacyCodes.length).toBeGreaterThan(0);
      
      // Full locales should appear first in the array
      const firstLegacyIndex = languages.findIndex(lang => lang.isLegacy);
      const lastFullLocaleIndex = languages.map(lang => lang.isLegacy).lastIndexOf(false);
      
      expect(firstLegacyIndex).toBeGreaterThan(lastFullLocaleIndex);
    });
  });

  describe('Language Mapping', () => {
    it('should map legacy en to en-US', () => {
      const locale = getLocaleForVariantLanguage('en');
      expect(locale).toBe('en-US');
    });

    it('should map legacy es to es-CO', () => {
      const locale = getLocaleForVariantLanguage('es');
      expect(locale).toBe('es-CO');
    });

    it('should keep full locales as-is', () => {
      expect(getLocaleForVariantLanguage('en-US')).toBe('en-US');
      expect(getLocaleForVariantLanguage('es-CO')).toBe('es-CO');
      expect(getLocaleForVariantLanguage('de')).toBe('de');
    });

    it('should map dashboard locales to themselves for variants (full locale system)', () => {
      const variantCode = getVariantLanguageForLocale('en-US');
      expect(variantCode).toBe('en-US');
      
      const variantCode2 = getVariantLanguageForLocale('es-CO');
      expect(variantCode2).toBe('es-CO');
    });

    it('should handle unknown language codes gracefully', () => {
      const locale = getLocaleForVariantLanguage('unknown');
      expect(locale).toBe('unknown');
    });
  });

  describe('Language Information', () => {
    it('should return language info for full locale codes', () => {
      const englishInfo = getLanguageInfo('en-US');
      
      expect(englishInfo).toBeDefined();
      expect(englishInfo?.variantCode).toBe('en-US');
      expect(englishInfo?.dashboardLocale).toBe('en-US');
      expect(englishInfo?.displayName).toContain('English');
      expect(englishInfo?.flagCode).toBeDefined();
      expect(englishInfo?.isLegacy).toBe(false);
    });

    it('should return language info for legacy codes', () => {
      const legacyEnglishInfo = getLanguageInfo('en');
      
      expect(legacyEnglishInfo).toBeDefined();
      expect(legacyEnglishInfo?.variantCode).toBe('en');
      expect(legacyEnglishInfo?.dashboardLocale).toBe('en-US');
      expect(legacyEnglishInfo?.isLegacy).toBe(true);
    });

    it('should return null for invalid variant codes', () => {
      const invalidInfo = getLanguageInfo('invalid');
      expect(invalidInfo).toBeNull();
    });
  });

  describe('Language Support Validation', () => {
    it('should validate supported full locales', () => {
      expect(isLanguageSupported('en-US')).toBe(true);
      expect(isLanguageSupported('es-CO')).toBe(true);
      expect(isLanguageSupported('invalid')).toBe(false);
    });

    it('should validate supported legacy codes', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('es')).toBe(true);
    });
  });

  describe('Primary Language Options', () => {
    it('should return primary languages (full locales) for variant creation', () => {
      const primaryLanguages = getPrimaryLanguageOptions();
      
      expect(Array.isArray(primaryLanguages)).toBe(true);
      expect(primaryLanguages.length).toBeGreaterThan(0);
      
      // Should include full locale codes, not legacy
      const codes = primaryLanguages.map(lang => lang.variantCode);
      expect(codes).toContain('en-US');
      expect(codes).toContain('es-CO');
      
      // Should not contain legacy codes in primary options
      expect(codes).not.toContain('en');
      expect(codes).not.toContain('es');
      
      // All should be non-legacy
      expect(primaryLanguages.every(lang => !lang.isLegacy)).toBe(true);
    });
  });

  describe('Legacy Language Options', () => {
    it('should return only legacy language options', () => {
      const legacyLanguages = getLegacyLanguageOptions();
      
      expect(Array.isArray(legacyLanguages)).toBe(true);
      expect(legacyLanguages.length).toBeGreaterThan(0);
      
      // All should be legacy
      expect(legacyLanguages.every(lang => lang.isLegacy)).toBe(true);
      
      // Should contain legacy codes
      const codes = legacyLanguages.map(lang => lang.variantCode);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
    });
  });
});
