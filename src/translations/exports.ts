// Auto-generated translation exports
// Built on: 2025-08-06T21:22:44.791Z

// Modular format (recommended)
export { default as enTranslations } from './dist/en.json';
export { default as esTranslations } from './dist/es.json';
export { default as deTranslations } from './dist/de.json';
export { default as es-COTranslations } from './dist/es-CO.json';
export { default as en-USTranslations } from './dist/en-US.json';

// Legacy format (for backward compatibility)
export { default as enLegacyTranslations } from './legacy/en-componentTranslations.json';
export { default as esLegacyTranslations } from './legacy/es-componentTranslations.json';
export { default as deLegacyTranslations } from './legacy/de-componentTranslations.json';
export { default as es-COLegacyTranslations } from './legacy/es-CO-componentTranslations.json';
export { default as en-USLegacyTranslations } from './legacy/en-US-componentTranslations.json';

// Type definitions
export interface TranslationMetadata {
  locale: string;
  buildTime: string;
  version: string;
  files: number;
}

export interface ComponentTranslations {
  [key: string]: any;
  $meta?: {
    file: string;
    lastUpdated?: string;
    completeness?: number;
    format?: string;
  };
}

export interface ModularTranslations {
  $metadata: TranslationMetadata;
  translations: {
    [component: string]: ComponentTranslations;
  };
}

// Supported locales
export const SUPPORTED_LOCALES = ["en","es","de","es-CO","en-US"];

// Locale metadata
export const LOCALE_METADATA = {
  'en': {
    code: 'en',
    name: 'English',
    baseLanguage: 'en',
    region: null,
    isRegional: false
  },
  'es': {
    code: 'es',
    name: 'Español',
    baseLanguage: 'es',
    region: null,
    isRegional: false
  },
  'de': {
    code: 'de',
    name: 'Deutsch',
    baseLanguage: 'de',
    region: null,
    isRegional: false
  },
  'es-CO': {
    code: 'es-CO',
    name: 'Español (Colombia)',
    baseLanguage: 'es',
    region: 'CO',
    isRegional: true
  },
  'en-US': {
    code: 'en-US',
    name: 'English (United States)',
    baseLanguage: 'en',
    region: 'US',
    isRegional: true
  }
};
