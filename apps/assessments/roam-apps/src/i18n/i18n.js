/*
Initialises the i18next module for language translation. Includes a json file under options->resources->en of all the button text,
as well as full screen, progress bar text. Also exports the task instructions and break text in a struct (multichoiceCorpus).
*/

import i18next from 'i18next'; //package for translating languages
import LanguageDetector from 'i18next-browser-languagedetector'; //detect user language in the browser
import enTranslations from './locales/en/translation.json'; //load local json as array, contains text for buttons, full screen, progress bar
import esTranslations from './locales/es/translation.json'; //load local json as array
import itTranslations from './locales/it/translation.json'; //load local json as array
import ptTranslations from './locales/pt/translation.json'; //load local json as array

//get browser language
const languageDetector = new LanguageDetector();

//add an option
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
/// Initialise this class with required language, json file for various buttons and some text
i18next
  .use(LanguageDetector)
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
      pt: {
        translation: ptTranslations,
      },
    },
  });
