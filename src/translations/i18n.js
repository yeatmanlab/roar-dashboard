import { createI18n } from 'vue-i18n';
import {
  enTranslations,
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
import { LEVANTE_PLATFORM_LOCALE, ROAR_PLATFORM_LOCALE } from '@/constants/locale';

export const languageOptions = {
  'en-US': { translations: enUSTranslations, language: 'English (United States)', code: 'usa' },
  en: { translations: enTranslations, language: 'English (United Kingdom)', code: 'gb' },
  es: { translations: esTranslations, language: 'Español (Spain)', code: 'es' },
  'es-CO': { translations: esCOTranslations, language: 'Español (América Latina)', code: 'col' },
  de: { translations: deTranslations, language: 'Deutsch', code: 'de' },
};

const browserLocale = window.navigator.language;

const getLocale = (localeFromBrowser) => {
  const localeFromStorage = sessionStorage.getItem(isLevante ? LEVANTE_PLATFORM_LOCALE : ROAR_PLATFORM_LOCALE);

  if (localeFromStorage) {
    return localeFromStorage;
  } else if (localeFromBrowser) {
    return localeFromBrowser;
  } else {
    return 'en-US';
  }
};

const getFallbackLocale = () => {
  const localeFromStorage = sessionStorage.getItem(isLevante ? LEVANTE_PLATFORM_LOCALE : ROAR_PLATFORM_LOCALE);

  return localeFromStorage ?? 'en-US';
};

export const i18n = createI18n({
  locale: getLocale(browserLocale),
  fallbackLocale: getFallbackLocale(),
  messages: {
    en: { ...enUSTranslations, ...enIndividualScoreReport },
    'en-US': { ...enUSTranslations, ...enUSIndividualScoreReport },
    es: { ...esTranslations, ...esIndividualScoreReport },
    'es-CO': { ...esCOTranslations, ...esCOIndividualScoreReport },
    de: deTranslations,
  },
  legacy: false,
  globalInjection: true,
});
