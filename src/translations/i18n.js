import { createI18n } from 'vue-i18n';
import { enTranslations, enUSTranslations, esTranslations, esCOTranslations } from './exports';

const locale = window.navigator.language;
const messages = {
  'en-US': enUSTranslations,
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
    console.log('Language not supported, using default en.');
    return messages['en'];
  }
};

export const i18n = createI18n({
  locale: locale,
  fallbackLocale: 'en-US',
  messages: getTranslations(),
  legacy: false,
});
