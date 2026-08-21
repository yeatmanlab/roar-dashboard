import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from '../locales/en/translation.json';
import esTranslations from '../locales/es/translation.json';
import ptTranslations from '../locales/pt/translation.json';
import deTranslations from '../locales/de/translation.json';
import { processCSV } from './config/loadCorpus';

const languageDetector = new LanguageDetector();

languageDetector.addDetector({
  name: 'defaultToEnglish',
  // eslint-disable-next-line no-unused-vars
  lookup(_options) {
    return 'en';
  },
});

// To change the language with a querystring, append "?lng=LANGUAGE" to the the URL
// LANGUAGE here refers to the language code
// Ex. For Spanish: https://roar-sre-demo.web.app/?lng=es
// With multiple querystrings: https://roar-sre-demo.web.app/?mode=demo&lng=es

i18next
  .use(LanguageDetector)
  .on('languageChanged', processCSV)
  // .on('initialized', handleLanguageDetection)
  .init({
    debug: false,
    // which langauage codes to use. Ex. if 'en-US' detected, will use 'en'
    load: 'languageOnly',
    fallbackLng: 'en',
    detection: {
      order: ['defaultToEnglish', 'querystring'],
    },
    resources: {
      en: {
        translation: enTranslations,
      },
      es: {
        translation: esTranslations,
      },
      it: {
        translation: 'itTranslations',
      },
      pt: {
        translation: ptTranslations,
      },
      de: {
        // german version
        translation: deTranslations,
      },
    },
  });
