import { createI18n } from 'vue-i18n';
import translations from './componentTranslations.json'

export const i18 = createI18n({
  locale: window.navigator.language,
  fallbackLocale: 'en',
  messages: translations,
})

