import { createI18n } from 'vue-i18n';
import enTranslations from './en/en-componentTranslations.json';
import esTranslations from './es/es-componentTranslations.json';
import esCOTranslations from './es/es-co-componentTranslations.json';

const locale = window.navigator.language;
const messages = {
  'en-US': enTranslations,
  en: enTranslations,
  es: esTranslations,
  'es-CO': esCOTranslations,
};

const getTranslations = () => {
  if (messages[locale]) {
    console.log('Language supported, using ' + locale + '.');
    return messages[locale];
  } else if (locale.includes('es')) {
    console.log('Language not supported, using default es.');
    return messages['es'];
  } else {
    console.log('Language not supported, using default en-US.');
    return messages['en-US'];
  }
};

export const i18n = createI18n({
  locale: locale,
  fallbackLocale: 'en-US',
  messages: getTranslations(),
  legacy: false,
});
