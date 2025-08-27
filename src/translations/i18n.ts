import { createI18n } from 'vue-i18n';
import {
  enUSTranslations,
  enIndividualScoreReport,
  enUSIndividualScoreReport,
  esTranslations,
  esCOTranslations,
  deTranslations,
  esIndividualScoreReport,
  esCOIndividualScoreReport,
} from './exports';
import { isLevante } from '@/helpers';

// Merge utility to deeply combine message trees
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key] as Record<string, any>, value as Record<string, any>);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function formatLocale(locale: string) {
  const parts = locale.split('-');
  const lang = (parts[0] || '').toLowerCase();
  const region = parts[1];
  return region ? `${lang}-${region.toUpperCase()}` : lang;
}

export const languageOptions: Record<string, { translations: any; language: string; code: string }> = {
  'en-US': {
    translations: enUSTranslations,
    language: 'English (United States)',
    code: 'usa',
  },
  es: { translations: esTranslations, language: 'Español (Spain)', code: 'es' },
  'es-CO': {
    translations: esCOTranslations,
    language: 'Español (América Latina)',
    code: 'col',
  },
  de: { translations: deTranslations, language: 'Deutsch', code: 'de' },
};

const browserLocale = window.navigator.language;

const getLocale = (localeFromBrowser: string) => {
  const storageKey = `${isLevante ? 'levante' : 'roar'}PlatformLocale`;
  const localeFromStorage = sessionStorage.getItem(storageKey);

  if (localeFromStorage) {
    return localeFromStorage;
  } else {
    sessionStorage.setItem(storageKey, localeFromBrowser);
    return localeFromBrowser;
  }
};

export const formattedLocale = getLocale(browserLocale);

const getFallbackLocale = () => {
  const storageKey = `${isLevante ? 'levante' : 'roar'}PlatformLocale`;
  const localeFromStorage = sessionStorage.getItem(storageKey) || '';

  if (localeFromStorage.includes('es')) {
    console.log('Setting fallback local to es-CO');
    return 'es-CO';
  } else if (localeFromStorage.includes('de')) {
    console.log('Setting fallback local to de');
    return 'de';
  } else {
    console.log('Setting fallback local to en-US');
    return 'en-US';
  }
};

// Map flat keys to nested paths for backward compatibility
const namespaceMap: Record<string, string> = {
  navBar: 'components.navbar',
  gameTabs: 'components.game-tabs',
  participantSidebar: 'components.participant-sidebar',
  sentryForm: 'components.sentry-form',
  tasks: 'components.tasks',
  notFound: 'pages.not-found',
  pageSignIn: 'pages.signin',
  homeParticipant: 'pages.home-participant',
  homeSelector: 'pages.home-selector',
  consentModal: 'auth.consent',
  authSignIn: 'auth.signin',
  userSurvey: 'surveys.user-survey',
};

// Helper function to add flat keys alongside nested ones
function addFlatKeys(messages: Record<string, any>): Record<string, any> {
  const result = { ...messages };
  
  // Add flat keys based on namespace mapping
  Object.entries(namespaceMap).forEach(([flatKey, nestedPath]) => {
    const pathParts = nestedPath.split('.');
    let current: any = messages;
    let found = true;
    
    // Navigate to the nested object
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current[part]) {
        current = current[part];
      } else {
        found = false;
        break;
      }
    }
    
    // If we found the nested object, add it as a flat key
    if (found && current && typeof current === 'object') {
      result[flatKey] = current;
    }
  });
  
  return result;
}

// Build base messages from existing imports
const baseMessages: Record<string, any> = {
  'en-US': addFlatKeys({ ...enUSTranslations, ...enUSIndividualScoreReport }),
  'es-CO': addFlatKeys({ ...esCOTranslations, ...esCOIndividualScoreReport }),
  de: addFlatKeys(deTranslations),
  // Legacy fallbacks for backward compatibility
  es: addFlatKeys({ ...esTranslations, ...esIndividualScoreReport }),
};

// Dynamically load any generated componentTranslations for new locales and merge
const modules = import.meta.glob('/src/translations/**/**-componentTranslations.json', { eager: true }) as Record<
  string,
  any
>;
for (const [filePath, mod] of Object.entries(modules)) {
  const match = filePath.match(/\/([a-z]{2}(?:-[a-z]{2})?)-componentTranslations\.json$/i);
  if (!match || !match[1]) continue;
  const rawLocale = match[1] as string; // e.g., en, es-co, fr-ca
  const locale = formatLocale(rawLocale);
  const content: Record<string, any> = ((mod as any)?.default ?? {}) as Record<string, any>;

  if (!baseMessages[locale]) baseMessages[locale] = {};
  deepMerge(baseMessages[locale] as Record<string, any>, content as Record<string, any>);
  
  // Apply flat key transformation to dynamically loaded content
  baseMessages[locale] = addFlatKeys(baseMessages[locale]);

  // Auto-register new locales in languageOptions if missing
  if (!languageOptions[locale]) {
    let displayName = locale;
    try {
      const parts = locale.split('-');
      const langCode = (parts[0] || locale).toLowerCase();
      const regionCode = (parts[1] || '').toUpperCase();

      // Language autonym (language name in its own language) with English fallback
      const langNames = new (window as any).Intl.DisplayNames([langCode, 'en'], { type: 'language' });
      // Region name in English for consistency
      const regionNames = new (window as any).Intl.DisplayNames(['en'], { type: 'region' });

      const langNameRaw = (langNames.of(langCode) as string | undefined) || langCode;
      const langName = /^[a-z]/.test(langNameRaw)
        ? langNameRaw.charAt(0).toLocaleUpperCase(langCode) + langNameRaw.slice(1)
        : langNameRaw;
      const regionName = regionCode ? (regionNames.of(regionCode) as string | undefined) : undefined;

      displayName = regionName ? `${langName} (${regionName})` : langName;
    } catch {
      // Fallback to locale string if Intl.DisplayNames is unavailable
    }

    const code = locale.includes('-') ? (locale.split('-')[1] || '').toLowerCase() : locale.toLowerCase();
    languageOptions[locale] = { translations: baseMessages[locale], language: displayName, code };
  }
}

export const i18n = createI18n({
  locale: getLocale(browserLocale),
  fallbackLocale: getFallbackLocale(),
  messages: baseMessages,
  legacy: false,
  globalInjection: true,
});

// Export for debugging
export { baseMessages };
