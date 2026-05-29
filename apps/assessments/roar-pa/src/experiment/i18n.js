import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from '../locales/en/translation.json';
import esTranslations from '../locales/es/translation.json';
import enCorpusTest from './config/corpus/en/test.csv';
import enCorpusPractice from './config/corpus/en/practice.csv';
import enCorpusPracticeCat from './config/corpus/en/practice-cat.csv';
import esCorpusPractice from './config/corpus/es/practice.csv';
import esCorpusTest from './config/corpus/es/test.csv';
import { processCSV } from './config/corpus';
import enCorpusTestCat from './config/corpus/en/test-cat.csv';
import deCorpusTest from './config/corpus/de/test.csv';
import deCorpusPractice from './config/corpus/de/practice.csv';
import deTranslations from '../locales/de/translation.json';
import enCorpusTestCatFoundational from './config/corpus/en/phoneme_foundational_composite.csv';

export const corpusTranslations = {
  en: {
    test: enCorpusTest,
    practice: enCorpusPractice,
    practiceCat: enCorpusPracticeCat,
    testCat: enCorpusTestCat,
    testCatFoundational: enCorpusTestCatFoundational,
  },
  es: {
    test: esCorpusTest,
    practice: esCorpusPractice,
  },
  de: {
    test: deCorpusTest,
    practice: deCorpusPractice,
  },
  // it: {
  //   test: itCorpusTest,
  //   practice: itCorpusPractice
  // },
};

const languageDetector = new LanguageDetector();

languageDetector.addDetector({
  name: 'defaultToEnglish',
  // eslint-disable-next-line no-unused-vars
  lookup(_options) {
    return 'en';
  },
});

// To change the language with a querystring, append "?lng=LANGUAGE" to the the URL
// LANGUAGE here refers to the the language code
// Ex. For Spanish: https://roar-swr-demo.web.app/?lng=es
// With multiple querystrings: https://roar-swr-demo.web.app/?isAdaptive=true&lng=es

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
      de: {
        translation: deTranslations,
      },
      it: {
        translation: 'itTranslations',
      },
    },
  });
