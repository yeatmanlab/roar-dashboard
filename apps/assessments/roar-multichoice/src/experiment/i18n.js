import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enStoryLion from "../stimuli/en/morphology-storyLion.csv";
import enCvaIntro from "../stimuli/en/cva-intro.csv";
import enTranslations from "../locales/en/translation.json";
import esTranslations from "../locales/es/translation.json";
import itTranslations from "../locales/it/translation.json";
import store from "store2";

const languageDetector = new LanguageDetector();

languageDetector.addDetector({
  name: "defaultToEnglish",
  // eslint-disable-next-line no-unused-vars
  lookup(_options) {
    return "en";
  },
});

// To change the language with a querystring, append "?lng=LANGUAGE" to the the URL
// LANGUAGE here refers to the the language code
// Ex. For Spanish: https://roar-swr-demo.web.app/?lng=es
// With multiple querystrings: https://roar-swr-demo.web.app/?mode=demo&lng=es

i18next
  .use(LanguageDetector)
  // .on('initialized', handleLanguageDetection)
  .init({
    debug: false,
    // which langauage codes to use. Ex. if 'en-US' detected, will use 'en'
    load: "languageOnly",
    fallbackLng: "en",
    detection: {
      order: ["defaultToEnglish", "querystring"],
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
    },
  });
export const multichoiceCorpus = {
  en: {
    task: {
      morphology: enStoryLion,
      cva: enCvaIntro,
    },
  },
  es: {
    surveyPractice: "",
    surveyMain: "",
    storyLion: "",
  },
  it: {
    surveyPractice: "",
    surveyMain: "",
    storyLion: "",
  },
};
