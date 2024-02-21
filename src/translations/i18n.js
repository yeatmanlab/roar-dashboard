import { createI18n } from 'vue-i18n';
import enTranslations from './en/en-componentTranslations.json';
import esTranslations from './es/es-componentTranslations.json';

const locale = window.navigator.language;
const messages = {
  'en-US': enTranslations,
  en: enTranslations,
  es: esTranslations,
};
export const i18n = createI18n({
  locale: locale,
  fallbackLocale: 'en',
  messages: messages[locale],
  legacy: false,
});

console.log(locale, messages[locale]);
