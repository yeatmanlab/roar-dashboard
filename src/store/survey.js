import { defineStore } from 'pinia';
import { parse, stringify } from 'zipson';

export const useSurveyStore = () => {
  return defineStore({
    id: 'surveyStore',
    state: () => {
      return {
        requireRefresh: false,
        // the survey instance
        survey: null,
        numGeneralPages: 0,
        numSpecificPages: 0,
        currentSurveyAudioSource: null,
        isSavingSurveyResponses: false,
        surveyAudioPlayerBuffers: {},
        surveyAudioLoading: false,
        allSurveyPages: [],
        allSpecificPages: [],
        currentPageIndex: 0,
        specificSurveyRelationData: [],
        // the index of the specific survey relation that is currently being displayed. IE. which class or child of a caregiver or teacher.
        specificSurveyRelationIndex: 0,
        isGeneralSurveyComplete: false,
        isSpecificSurveyComplete: false,
        isSurveyCompleted: false,
        audioLinkMap: {},
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
      setNumberOfSurveyPages(numGeneralPages, numSpecificPages) {
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
      setAllSpecificPages(pages) {
        this.allSpecificPages = pages;
      },
      // Out of the total pages, the current page index is the index of the page that is currently being displayed
      setCurrentPageIndex(index) {
        this.currentPageIndex = index;
      },
      setSpecificSurveyRelationData(data) {
        this.specificSurveyRelationData = data;
      },
      setSpecificSurveyRelationIndex(index) {
        this.specificSurveyRelationIndex = index;
      },
      setIsGeneralSurveyComplete(isComplete) {
        this.isGeneralSurveyComplete = isComplete;
      },
      setIsSpecificSurveyComplete(isComplete) {
        this.isSpecificSurveyComplete = isComplete;
      },
      setAudioLinkMap(map) {
        this.audioLinkMap = map;
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
