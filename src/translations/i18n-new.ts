import { createI18n } from 'vue-i18n'
import { isLevante } from '@/helpers'

// Import modular translations
import enTranslations from './locales/en.json'
import esTranslations from './locales/es.json'
import deTranslations from './locales/de.json'
import enUSTranslations from './locales/en-US.json'
import esCOTranslations from './locales/es-CO.json'

// Legacy imports for backward compatibility
import {
  enIndividualScoreReport,
  enUSIndividualScoreReport,
  esIndividualScoreReport,
  esCOIndividualScoreReport,
} from './exports'

// Flatten modular translations for vue-i18n compatibility
function flattenTranslations(modularData: any): Record<string, any> {
  if (!modularData?.translations) {
    return modularData || {}
  }
  
  const result: Record<string, any> = {}
  
  for (const [component, translations] of Object.entries(modularData.translations)) {
    result[component] = flattenObject(translations)
  }
  
  return result
}

function flattenObject(obj: any, prefix = ''): any {
  const result: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) {
      // Skip metadata
      continue
    }
    
    const newKey = prefix ? `${prefix}.${key}` : key
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.value !== undefined) {
        // New format: { value: "text", context: "..." }
        result[newKey] = value.value
      } else {
        // Nested object
        Object.assign(result, flattenObject(value, newKey))
      }
    } else {
      // Primitive value
      result[newKey] = value
    }
  }
  
  return result
}

// Language configuration with enhanced metadata
export const languageOptions = {
  'en-US': {
    translations: flattenTranslations(enUSTranslations),
    language: 'English (United States)',
    code: 'usa',
    region: 'US',
    baseLanguage: 'en'
  },
  en: {
    translations: flattenTranslations(enTranslations),
    language: 'English (United Kingdom)',
    code: 'gb',
    region: null,
    baseLanguage: 'en'
  },
  es: {
    translations: flattenTranslations(esTranslations),
    language: 'Español (Spain)',
    code: 'es',
    region: null,
    baseLanguage: 'es'
  },
  'es-CO': {
    translations: flattenTranslations(esCOTranslations),
    language: 'Español (América Latina)',
    code: 'col',
    region: 'CO',
    baseLanguage: 'es'
  },
  de: {
    translations: flattenTranslations(deTranslations),
    language: 'Deutsch',
    code: 'de',
    region: null,
    baseLanguage: 'de'
  },
}

// Get browser locale with enhanced detection
const browserLocale = window.navigator.language
const storageKey = `${isLevante ? 'levante' : 'roar'}PlatformLocale`

const getLocale = (localeFromBrowser: string) => {
  const localeFromStorage = sessionStorage.getItem(storageKey)

  if (localeFromStorage && languageOptions[localeFromStorage as keyof typeof languageOptions]) {
    return localeFromStorage
  }
  
  // Try exact match first
  if (languageOptions[localeFromBrowser as keyof typeof languageOptions]) {
    sessionStorage.setItem(storageKey, localeFromBrowser)
    return localeFromBrowser
  }
  
  // Try base language match
  const baseLanguage = localeFromBrowser.split('-')[0]
  const matchingLocale = Object.keys(languageOptions).find(locale => 
    languageOptions[locale as keyof typeof languageOptions].baseLanguage === baseLanguage
  )
  
  if (matchingLocale) {
    sessionStorage.setItem(storageKey, matchingLocale)
    return matchingLocale
  }
  
  // Default to en-US
  const defaultLocale = 'en-US'
  sessionStorage.setItem(storageKey, defaultLocale)
  return defaultLocale
}

export const formattedLocale = getLocale(browserLocale)

const getFallbackLocale = () => {
  const localeFromStorage = sessionStorage.getItem(storageKey)
  
  if (!localeFromStorage) return 'en-US'

  const baseLanguage = localeFromStorage.split('-')[0]
  
  // Use base language as fallback, or default to English
  const fallbackMap: Record<string, string> = {
    'es': 'es',
    'de': 'de',
    'en': 'en-US'
  }
  
  return fallbackMap[baseLanguage] || 'en-US'
}

// Create enhanced i18n instance
export const i18n = createI18n({
  locale: formattedLocale,
  fallbackLocale: getFallbackLocale(),
  messages: {
    'en': { 
      ...languageOptions['en'].translations, 
      ...enIndividualScoreReport 
    },
    'en-US': { 
      ...languageOptions['en-US'].translations, 
      ...enUSIndividualScoreReport 
    },
    'es': { 
      ...languageOptions['es'].translations, 
      ...esIndividualScoreReport 
    },
    'es-CO': { 
      ...languageOptions['es-CO'].translations, 
      ...esCOIndividualScoreReport 
    },
    'de': { 
      ...languageOptions['de'].translations 
    },
  },
  legacy: false,
  globalInjection: true,
  
  // Enhanced options
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
  silentTranslationWarn: !import.meta.env.DEV,
  silentFallbackWarn: !import.meta.env.DEV,
})

// Export utility functions
export function switchLocale(newLocale: string) {
  if (languageOptions[newLocale as keyof typeof languageOptions]) {
    i18n.global.locale.value = newLocale
    sessionStorage.setItem(storageKey, newLocale)
    console.log(`🌐 Switched to locale: ${newLocale}`)
    return true
  }
  
  console.warn(`🌐 Locale not available: ${newLocale}`)
  return false
}

export function getAvailableLocales() {
  return Object.keys(languageOptions)
}

export function getLocaleMetadata(locale: string) {
  return languageOptions[locale as keyof typeof languageOptions] || null
}

export function isRTL(locale: string): boolean {
  const rtlLocales = ['ar', 'he', 'fa', 'ur']
  const baseLanguage = locale.split('-')[0]
  return rtlLocales.includes(baseLanguage)
}

// Development utilities
if (import.meta.env.DEV) {
  // Add global functions for development
  ;(window as any).__i18n_debug = {
    switchLocale,
    getAvailableLocales,
    getLocaleMetadata,
    currentLocale: () => i18n.global.locale.value,
    messages: () => i18n.global.messages.value
  }
  
  console.log('🌐 i18n Debug tools available at window.__i18n_debug')
}