/**
 * Enhanced i18n Composable
 * Provides improved translation functionality with context and validation
 */

import { computed, ref, watch } from 'vue'
import { useI18n as useVueI18n } from 'vue-i18n'
import type { TranslationMetadata, ComponentTranslations } from '../exports'

interface TranslationContext {
  component?: string
  maxLength?: number
  variables?: string[]
  fallback?: string
}

interface TranslationOptions {
  context?: TranslationContext
  reportMissing?: boolean
  logUsage?: boolean
}

// Track missing translations and usage
const missingTranslations = ref<Set<string>>(new Set())
const translationUsage = ref<Map<string, number>>(new Map())
const isDevelopment = import.meta.env.DEV

export function useEnhancedI18n() {
  const vueI18n = useVueI18n()
  
  // Enhanced translation function with context and validation
  const t = (key: string, options: TranslationOptions = {}) => {
    const { context, reportMissing = isDevelopment, logUsage = isDevelopment } = options
    
    // Track usage in development
    if (logUsage) {
      const currentCount = translationUsage.value.get(key) || 0
      translationUsage.value.set(key, currentCount + 1)
    }
    
    try {
      const translation = vueI18n.t(key)
      
      // Check if translation is missing (returns the key itself)
      if (translation === key && reportMissing) {
        missingTranslations.value.add(key)
        console.warn(`🌐 Missing translation: ${key}`, context)
        
        // Return fallback if provided
        if (context?.fallback) {
          return context.fallback
        }
      }
      
      // Validate length constraints
      if (context?.maxLength && translation.length > context.maxLength) {
        console.warn(`🌐 Translation too long: ${key} (${translation.length}>${context.maxLength})`)
      }
      
      // Validate variables if provided
      if (context?.variables) {
        const missingVars = context.variables.filter(variable => 
          !translation.includes(`{${variable}}`)
        )
        if (missingVars.length > 0) {
          console.warn(`🌐 Missing variables in translation ${key}:`, missingVars)
        }
      }
      
      return translation
      
    } catch (error) {
      console.error(`🌐 Translation error for ${key}:`, error)
      return context?.fallback || key
    }
  }
  
  // Pluralization with enhanced features
  const tc = (key: string, count: number, options: TranslationOptions = {}) => {
    try {
      return vueI18n.tc(key, count)
    } catch (error) {
      console.error(`🌐 Pluralization error for ${key}:`, error)
      return options.context?.fallback || key
    }
  }
  
  // Translation metadata access
  const tm = (key: string): any => {
    try {
      return vueI18n.tm(key)
    } catch (error) {
      console.error(`🌐 Metadata access error for ${key}:`, error)
      return null
    }
  }
  
  // Component-scoped translation helper
  const componentT = (component: string, key: string, options: TranslationOptions = {}) => {
    const fullKey = `${component}.${key}`
    return t(fullKey, {
      ...options,
      context: {
        component,
        ...options.context
      }
    })
  }
  
  // Get available locales
  const availableLocales = computed(() => vueI18n.availableLocales)
  
  // Current locale
  const locale = computed({
    get: () => vueI18n.locale.value,
    set: (newLocale: string) => {
      if (availableLocales.value.includes(newLocale)) {
        vueI18n.locale.value = newLocale
        
        // Update session storage
        const storageKey = import.meta.env.VITE_PLATFORM_NAME === 'levante' 
          ? 'levantePlatformLocale' 
          : 'roarPlatformLocale'
        sessionStorage.setItem(storageKey, newLocale)
        
        console.log(`🌐 Locale changed to: ${newLocale}`)
      } else {
        console.warn(`🌐 Locale not available: ${newLocale}`)
      }
    }
  })
  
  // Fallback locale
  const fallbackLocale = computed(() => vueI18n.fallbackLocale.value)
  
  // Translation completeness for current locale
  const completeness = computed(() => {
    const messages = vueI18n.messages.value[locale.value] || {}
    const englishMessages = vueI18n.messages.value['en'] || {}
    
    const countKeys = (obj: any): number => {
      let count = 0
      for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
          count += countKeys(value)
        } else {
          count++
        }
      }
      return count
    }
    
    const currentKeys = countKeys(messages)
    const totalKeys = countKeys(englishMessages)
    
    return totalKeys > 0 ? Math.round((currentKeys / totalKeys) * 100) : 0
  })
  
  // Get missing translations list
  const getMissingTranslations = () => Array.from(missingTranslations.value)
  
  // Get translation usage statistics
  const getUsageStatistics = () => Object.fromEntries(translationUsage.value)
  
  // Clear missing translations and usage tracking
  const clearDiagnostics = () => {
    missingTranslations.value.clear()
    translationUsage.value.clear()
  }
  
  // Generate translation report
  const generateReport = () => ({
    locale: locale.value,
    completeness: completeness.value,
    missingTranslations: getMissingTranslations(),
    usageStatistics: getUsageStatistics(),
    timestamp: new Date().toISOString()
  })
  
  // Watch for locale changes to clear diagnostics
  watch(locale, () => {
    clearDiagnostics()
  })
  
  return {
    // Core translation functions
    t,
    tc,
    tm,
    componentT,
    
    // Locale management
    locale,
    fallbackLocale,
    availableLocales,
    
    // Translation quality
    completeness,
    
    // Development tools
    getMissingTranslations,
    getUsageStatistics,
    clearDiagnostics,
    generateReport,
    
    // Compatibility with vue-i18n
    ...vueI18n
  }
}

// Export for use in options API components
export function setupI18n() {
  return useEnhancedI18n()
}