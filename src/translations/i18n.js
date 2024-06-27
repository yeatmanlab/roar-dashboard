import { createI18n } from 'vue-i18n';
import { enTranslations, enUSTranslations, esTranslations, esCOTranslations, deTranslations } from './exports';

export const languageOptions = {
  'en-US': { translations: enUSTranslations, language: 'English (United States)', code: 'usa' },
  en: { translations: enTranslations, language: 'English (United Kingdom)', code: 'gb' },
  es: { translations: esTranslations, language: 'Español (Spain)', code: 'es' },
  'es-CO': { translations: esCOTranslations, language: 'Español (América Latina)', code: 'col' },
  de: { translations: deTranslations, language: 'Deutsch', code: 'de' },
};

const browserLocale = window.navigator.language;
const isLevante = import.meta.env.MODE === 'LEVANTE';

const getLocale = (localeFromBrowser) => {
  const localeFromStorage = sessionStorage.getItem(`${isLevante ? 'levante' : 'roar'}PlatformLocale`);

  if (localeFromStorage) {
    return localeFromStorage;
  } else {
    sessionStorage.setItem(`${isLevante ? 'levante' : 'roar'}PlatformLocale`, localeFromBrowser);
    return localeFromBrowser;
  }
};

const getFallbackLocale = () => {
  const localeFromStorage = sessionStorage.getItem(`${isLevante ? 'levante' : 'roar'}PlatformLocale`);

  if (localeFromStorage.includes('es')) {
    console.log('Setting fallback local to es');
    return 'es';
  } else if (localeFromStorage.includes('de')) {
    console.log('Setting fallback local to de');
    return 'de';
  } else {
    console.log('Setting fallback local to en-US');
    return 'en-US';
  }
};

export const i18n = createI18n({
  locale: getLocale(browserLocale),
  fallbackLocale: getFallbackLocale(),
  messages: {
    en: enUSTranslations,
    'en-US': enUSTranslations,
    es: esTranslations,
    'es-CO': esCOTranslations,
    de: deTranslations,
  },
  legacy: false,
  globalInjection: true,
});
