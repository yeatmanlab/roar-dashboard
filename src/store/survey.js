import { defineStore } from 'pinia';
import { ref, markRaw } from 'vue';

export const useSurveyStore = defineStore('surveyStore', () => {
  // State
  const requireRefresh = ref(false);
  const survey = ref(null); // This will hold the markRaw survey
  const numGeneralPages = ref(0);
  const numSpecificPages = ref(0);
  const currentSurveyAudioSource = ref(null);
  const isSavingSurveyResponses = ref(false);
  const surveyAudioPlayerBuffers = ref({});
  const surveyAudioLoading = ref(false);
  const allSurveyPages = ref([]);
  const allSpecificPages = ref([]);
  const currentPageIndex = ref(0);
  const specificSurveyRelationData = ref([]);
  const specificSurveyRelationIndex = ref(0);
  const isGeneralSurveyComplete = ref(false);
  const isSpecificSurveyComplete = ref(false);
  const isSurveyCompleted = ref(false);
  const audioLinkMap = ref({});

  // Actions
  function requireHomeRefresh() {
    requireRefresh.value = true;
  }

  function setSurveyCompleted() {
    isSurveyCompleted.value = true;
  }

  function setSurvey(surveyInstance) {
    // Mark the survey instance as raw to prevent deep reactivity
    survey.value = markRaw(surveyInstance);
  }

  function setNumberOfSurveyPages(numGeneral, numSpecific) {
    numGeneralPages.value = numGeneral;
    numSpecificPages.value = numSpecific;
  }

  function setCurrentSurveyAudioSource(audioSource) {
    currentSurveyAudioSource.value = audioSource;
  }

  function setIsSavingSurveyResponses(isSaving) {
    isSavingSurveyResponses.value = isSaving;
  }

  function setSurveyAudioPlayerBuffers(parsedLocale, bufferList) {
    surveyAudioPlayerBuffers.value[parsedLocale] = bufferList;
  }

  function setSurveyAudioLoading(loading) {
    surveyAudioLoading.value = loading;
  }

  function setAllSurveyPages(pages) {
    allSurveyPages.value = pages;
  }

  function setAllSpecificPages(pages) {
    allSpecificPages.value = pages;
  }

  function setCurrentPageIndex(index) {
    currentPageIndex.value = index;
  }

  function setSpecificSurveyRelationData(data) {
    specificSurveyRelationData.value = data;
  }

  function setSpecificSurveyRelationIndex(index) {
    specificSurveyRelationIndex.value = index;
  }

  function setIsGeneralSurveyComplete(isComplete) {
    isGeneralSurveyComplete.value = isComplete;
  }

  function setIsSpecificSurveyComplete(isComplete) {
    isSpecificSurveyComplete.value = isComplete;
  }

  function setAudioLinkMap(map) {
    audioLinkMap.value = map;
  }

  function reset() {
    requireRefresh.value = false;
    survey.value = null;
    numGeneralPages.value = 0;
    numSpecificPages.value = 0;
    currentSurveyAudioSource.value = null;
    isSavingSurveyResponses.value = false;
    surveyAudioPlayerBuffers.value = {};
    surveyAudioLoading.value = false;
    allSurveyPages.value = [];
    allSpecificPages.value = [];
    currentPageIndex.value = 0;
    specificSurveyRelationData.value = [];
    specificSurveyRelationIndex.value = 0;
    isGeneralSurveyComplete.value = false;
    isSpecificSurveyComplete.value = false;
    isSurveyCompleted.value = false;
    audioLinkMap.value = {};
  }

  return {
    // State
    requireRefresh,
    survey,
    numGeneralPages,
    numSpecificPages,
    currentSurveyAudioSource,
    isSavingSurveyResponses,
    surveyAudioPlayerBuffers,
    surveyAudioLoading,
    allSurveyPages,
    allSpecificPages,
    currentPageIndex,
    specificSurveyRelationData,
    specificSurveyRelationIndex,
    isGeneralSurveyComplete,
    isSpecificSurveyComplete,
    isSurveyCompleted,
    audioLinkMap,
    
    // Actions
    requireHomeRefresh,
    setSurveyCompleted,
    setSurvey,
    setNumberOfSurveyPages,
    setCurrentSurveyAudioSource,
    setIsSavingSurveyResponses,
    setSurveyAudioPlayerBuffers,
    setSurveyAudioLoading,
    setAllSurveyPages,
    setAllSpecificPages,
    setCurrentPageIndex,
    setSpecificSurveyRelationData,
    setSpecificSurveyRelationIndex,
    setIsGeneralSurveyComplete,
    setIsSpecificSurveyComplete,
    setAudioLinkMap,
    reset,
  };
});
