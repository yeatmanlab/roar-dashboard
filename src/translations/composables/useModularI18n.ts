/**
 * Modular i18n system for LEVANTE Dashboard
 * Loads translations from the new modular structure in src/translations/locales/
 */

import { createI18n } from 'vue-i18n'
import type { I18nOptions } from 'vue-i18n'

// Import component manifest to know what files to load
import componentManifest from '../base/component-manifest.json'

// Preload all locale JSON files so Vite can statically include them
const localeModules = import.meta.glob('../locales/**/*.json', { eager: true }) as Record<string, { default: TranslationFile }>

interface TranslationFile {
  $schema: string
  $metadata: {
    component: string
    lastUpdated: string
    completeness: number
    context: string
    source: string
  }
  translations: Record<string, { value: string; context: string }>
}

interface FlatTranslations {
  [key: string]: string
}

/**
 * Load all translation files for a specific language
 */
async function loadLanguageTranslations(locale: string): Promise<FlatTranslations> {
  const flatTranslations: FlatTranslations = {}

  // Define category mappings to match existing key patterns
  const categoryMappings = {
    'auth': {
      'signin': 'authSignIn',
      'consent': 'authConsent'
    },
    'components': {
      'navbar': 'navBar',
      'game-tabs': 'gameTabs',
      'participant-sidebar': 'participantSidebar',
      'sentry-form': 'sentryForm',
      'tasks': 'tasks'
    },
    'pages': {
      'signin': 'pageSignIn',
      'home-participant': 'homeParticipant',
      'home-selector': 'homeSelector',
      'not-found': 'notFound',
      'page-titles': 'pageTitles',
      'profile': 'pageProfile'
    },
    'surveys': {
      'user-survey': 'userSurvey'
    }
  }

  // Load files based on component manifest
  for (const [componentKey, componentInfo] of Object.entries(componentManifest.components)) {
    try {
      // Import the translation file dynamically
      const filePath = `../locales/${locale}/${componentInfo.file}`
      
      try {
        const module = localeModules[`../locales/${locale}/${componentInfo.file}`]
        if (!module) throw new Error('Missing module: ' + filePath)
        const translationFile: TranslationFile = module.default
        
        // Extract category and component from file path
        const pathParts = componentInfo.file.split('/')
        const category = pathParts[0] as keyof typeof categoryMappings
        const component = pathParts[1].replace('.json', '')
        
        // Get the flattened key prefix
        const keyPrefix = categoryMappings[category]?.[component as keyof typeof categoryMappings[typeof category]]
        
        if (keyPrefix && translationFile.translations) {
          // Flatten translations under the mapped key prefix
          for (const [key, translation] of Object.entries(translationFile.translations)) {
            const flatKey = `${keyPrefix}.${key}`
            flatTranslations[flatKey] = translation.value || ''
          }
        }
      } catch (importError) {
        // File doesn't exist for this language, skip silently
        console.debug(`Translation file not found: ${filePath}`)
      }
    } catch (error) {
      console.warn(`Error loading translation component ${componentKey} for ${locale}:`, error)
    }
  }

  return flatTranslations
}

/**
 * Load all messages for all supported languages
 */
async function loadAllMessages(): Promise<Record<string, FlatTranslations>> {
  const messages: Record<string, FlatTranslations> = {}
  
  // Get supported languages from manifest
  const supportedLanguages = componentManifest.supportedLanguages || ['en']
  
  // Load translations for each language
  await Promise.all(
    supportedLanguages.map(async (locale) => {
      try {
        messages[locale] = await loadLanguageTranslations(locale)
        console.log(`📚 Loaded ${Object.keys(messages[locale]).length} translations for ${locale}`)
      } catch (error) {
        console.error(`Failed to load translations for ${locale}:`, error)
        messages[locale] = {}
      }
    })
  )

  return messages
}

/**
 * Create the i18n instance with modular translations
 */
export async function createModularI18n(): Promise<ReturnType<typeof createI18n>> {
  const messages = await loadAllMessages()
  
  // Detect browser locale
  const browserLocale = navigator.language || navigator.languages?.[0] || 'en'
  const normalizedLocale = browserLocale.toLowerCase()
  
  // Find best matching locale
  const availableLocales = Object.keys(messages)
  let selectedLocale = 'en' // fallback
  
  // Exact match
  if (availableLocales.includes(normalizedLocale)) {
    selectedLocale = normalizedLocale
  } else {
    // Check for language-only match (e.g., 'en' for 'en-US')
    const languageOnly = normalizedLocale.split('-')[0]
    const languageMatch = availableLocales.find(locale => locale.startsWith(languageOnly))
    if (languageMatch) {
      selectedLocale = languageMatch
    }
  }

  console.log(`🌐 i18n initialized with locale: ${selectedLocale}`)
  console.log(`🌐 Available locales: ${availableLocales.join(', ')}`)

  const i18nOptions: I18nOptions = {
    locale: selectedLocale,
    fallbackLocale: 'en',
    messages,
    legacy: false,
    globalInjection: true,
    missingWarn: import.meta.env.DEV,
    fallbackWarn: import.meta.env.DEV,
    silentTranslationWarn: !import.meta.env.DEV,
    silentFallbackWarn: !import.meta.env.DEV,
  }

  return createI18n(i18nOptions)
}

/**
 * Enhanced composable that works with the modular system
 */
export function useModularTranslation() {
  // This will be called from components after i18n is set up
  return {
    // Add any additional functionality here
    supportedLanguages: componentManifest.supportedLanguages || ['en'],
    
    // Method to check if a locale is supported
    isLocaleSupported: (locale: string) => {
      return (componentManifest.supportedLanguages || ['en']).includes(locale)
    },
    
    // Method to get translation completeness for a locale
    getTranslationCompleteness: async (locale: string) => {
      const translations = await loadLanguageTranslations(locale)
      const totalKeys = Object.keys(translations).length
      const nonEmptyKeys = Object.values(translations).filter(value => value.trim() !== '').length
      
      return totalKeys > 0 ? Math.round((nonEmptyKeys / totalKeys) * 100) : 0
    }
  }
}
