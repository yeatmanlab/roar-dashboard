import { defineStore } from 'pinia';
import { parse, stringify } from 'zipson';

export const useGameStore = () => {
  return defineStore({
    id: 'gameStore',
    state: () => {
      return {
        selectedAdmin: undefined,
        requireRefresh: false,
        // LEVANTE -------------
        isSurveyCompleted: false,
        // the survey instance
        survey: null,
        numGeneralPages:0,
        numSpecificPages:0,
        currentSurveyAudioSource: null,
        isSavingSurveyResponses: false,
        surveyAudioPlayerBuffers: {},
        surveyAudioLoading: false,
        allSurveyPages: [],
        currentPageIndex: 0,
      };
    },
    actions: {
      requireHomeRefresh() {
        this.requireRefresh = true;
      },
      setSurveyCompleted() {
        this.isSurveyCompleted = true;
      },
      setSurvey(survey) {
        this.survey = survey;
      },
      setSurveyPages(numGeneralPages, numSpecificPages) {
        this.numGeneralPages = numGeneralPages;
        this.numSpecificPages = numSpecificPages;
      },
      setCurrentSurveyAudioSource(audioSource) {
        this.currentSurveyAudioSource = audioSource;
      },
      setIsSavingSurveyResponses(isSaving) {
        this.isSavingSurveyResponses = isSaving;
      },
      setSurveyAudioPlayerBuffers(parsedLocale, bufferList) {
        this.surveyAudioPlayerBuffers[parsedLocale] = bufferList;
      },
      setSurveyAudioLoading(loading) {
        this.surveyAudioLoading = loading;
      },
      setAllSurveyPages(pages) {
        this.allSurveyPages = pages;
      },
      setCurrentPageIndex(index) {
        this.currentPageIndex = index;
      },
    },
    persist: {
      storage: sessionStorage,
      debug: false,
      serializer: {
        deserialize: parse,
        serialize: stringify,
      },
    },
  })();
};
