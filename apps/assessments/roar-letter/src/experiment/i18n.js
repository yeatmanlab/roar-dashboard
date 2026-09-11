import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English

import enLetterNameLower from '../stimuli/en/letterNameLower.csv';
import enLetterNameUpper from '../stimuli/en/letterNameUpper.csv';
import enLetterNamePractice from '../stimuli/en/letterNamePractice.csv';
import enLetterPhoneme from '../stimuli/en/letterPhoneme.csv';
import enLetterPhonemePractice from '../stimuli/en/letterPhonemePractice.csv';
import enLetterTextSoundPseudo from '../stimuli/en/roar-phonics-2025-08-01-v3.csv';

import enStoryLion from '../stimuli/en/storyLion.csv';
import enStoryLionAge12 from '../stimuli/en/storyLionAge12.csv';
import enStoryPhonics from '../stimuli/en/storyPhonics.csv';
import enPracticePhonics from '../stimuli/en/practicePhonics.csv';
import enTranslations from '../locales/en/translation.json';

// Spanish

import esTranslations from '../locales/es/translation.json';
import esLetterNameLower from '../stimuli/es/letterNameLower.csv';
import esLetterNameUpper from '../stimuli/es/letterNameUpper.csv';
import esLetterNamePractice from '../stimuli/es/letterNamePractice.csv';
import esLetterPhoneme from '../stimuli/es/letterPhoneme.csv';
import esLetterPhonemePractice from '../stimuli/es/letterPhonemePractice.csv';
import esLetterTextSoundPseudo from '../stimuli/es/textSoundPseudo.csv';

import esStoryLion from '../stimuli/es/storyLion.csv';
import esStoryPhonics from '../stimuli/es/storyPhonics.csv';
import esPracticePhonics from '../stimuli/es/practicePhonics.csv';

// Italian

import itTranslations from '../locales/it/translation.json';
import itLetterNameLower from '../stimuli/it/letterNameLower.csv';
import itLetterNameUpper from '../stimuli/it/letterNameUpper.csv';
import itLetterNamePractice from '../stimuli/it/letterNamePractice.csv';
import itLetterPhoneme from '../stimuli/it/letterPhoneme.csv';
import itLetterPhonemePractice from '../stimuli/it/letterPhonemePractice.csv';
import itLetterTextSoundPseudo from '../stimuli/it/textSoundPseudo.csv';
import itStoryLion from '../stimuli/it/storyLion.csv';
import itStoryPhonics from '../stimuli/it/storyPhonics.csv';
import itPracticePhonics from '../stimuli/it/practicePhonics.csv';

// English Canada

import enCaLetterNameLower from '../stimuli/en-ca/letterNameLower.csv';
import enCaLetterNameUpper from '../stimuli/en-ca/letterNameUpper.csv';
import enCaLetterNamePractice from '../stimuli/en-ca/letterNamePractice.csv';
import enCaLetterPhoneme from '../stimuli/en-ca/letterPhoneme.csv';
import enCaLetterPhonemePractice from '../stimuli/en-ca/letterPhonemePractice.csv';
import enCaStoryLion from '../stimuli/en-ca/storyLion.csv';
import enCaStoryPhonics from '../stimuli/en-ca/storyPhonics.csv';
import enCaPracticePhonics from '../stimuli/en-ca/practicePhonics.csv';
import enCaStoryLionAge12 from '../stimuli/en-ca/storyLionAge12.csv';

import { processCVS } from './config/corpus';

export const letters = {
  en: {
    letterNameLower: enLetterNameLower,
    letterNameUpper: enLetterNameUpper,
    letterNamePractice: enLetterNamePractice,
    letterPhoneme: enLetterPhoneme,
    letterPhonemePractice: enLetterPhonemePractice,
    letterTextSoundPseudo: enLetterTextSoundPseudo,
    storyLion: enStoryLion,
    storyLionAge12: enStoryLionAge12,
    storyPhonics: enStoryPhonics,
    practicePhonics: enPracticePhonics,
  },
  es: {
    letterNameLower: esLetterNameLower,
    letterNameUpper: esLetterNameUpper,
    letterNamePractice: esLetterNamePractice,
    letterPhoneme: esLetterPhoneme,
    letterPhonemePractice: esLetterPhonemePractice,
    letterTextSoundPseudo: esLetterTextSoundPseudo,
    storyLion: esStoryLion,
    storyLionAge12: esStoryLion,
    storyPhonics: esStoryPhonics,
    practicePhonics: esPracticePhonics,
  },
  it: {
    letterNameLower: itLetterNameLower,
    letterNameUpper: itLetterNameUpper,
    letterNamePractice: itLetterNamePractice,
    letterPhoneme: itLetterPhoneme,
    letterPhonemePractice: itLetterPhonemePractice,
    letterTextSoundPseudo: itLetterTextSoundPseudo,
    storyLion: itStoryLion,
    storyLionAge12: itStoryLion,
    storyPhonics: itStoryPhonics,
    practicePhonics: itPracticePhonics,
  },
  'en-CA': {
    letterNameLower: enCaLetterNameLower,
    letterNameUpper: enCaLetterNameUpper,
    letterNamePractice: enCaLetterNamePractice,
    letterPhoneme: enCaLetterPhoneme,
    letterPhonemePractice: enCaLetterPhonemePractice,
    storyLion: enCaStoryLion,
    storyLionAge12: enCaStoryLionAge12,
    storyPhonics: enCaStoryPhonics,
    practicePhonics: enCaPracticePhonics,
  },
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
// With multiple querystrings: https://roar-swr-demo.web.app/?mode=demo&lng=es

i18next
  .use(LanguageDetector)
  .on('languageChanged', processCVS)
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
        translation: itTranslations,
      },
      'en-CA': {
        translation: enTranslations,
      },
    },
  });
