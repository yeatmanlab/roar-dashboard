import { createI18n } from 'vue-i18n';
import {
  enTranslations,
  enUSTranslations,
  enIndividualScoreReport,
  enUSIndividualScoreReport,
  esTranslations,
  esCOTranslations,
  esIndividualScoreReport,
  esCOIndividualScoreReport,
} from './exports';

export const languageOptions = {
  'en-US': { translations: enUSTranslations, language: 'English (United States)', code: 'usa' },
  en: { translations: enTranslations, language: 'English (United Kingdom)', code: 'gb' },
  es: { translations: esTranslations, language: 'Español (Spain)', code: 'es' },
  'es-CO': { translations: esCOTranslations, language: 'Español (América Latina)', code: 'col' },
};
export let browserLocale = window.navigator.language;

const getLocale = (locale) => {
  if (Object.keys(languageOptions).includes(locale)) {
    return locale;
  } else if (locale.includes('es')) {
    return 'es';
  } else {
    return 'en-US';
  }
};

const getFallbackLocale = (locale) => {
  if (locale.includes('es')) {
    return 'es';
  } else {
    return 'en-US';
  }
};

export const i18n = createI18n({
  locale: getLocale(browserLocale),
  fallbackLocale: getFallbackLocale(browserLocale),
  messages: {
    en: { ...enUSTranslations, ...enIndividualScoreReport },
    'en-US': { ...enUSTranslations, ...enUSIndividualScoreReport },
    es: { ...esTranslations, ...esIndividualScoreReport },
    'es-CO': { ...esCOTranslations, ...esCOIndividualScoreReport },
  },
  legacy: false,
  globalInjection: true,
});
