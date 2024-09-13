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
        numSurveyGeneralQuestions: 0,
        numSurveySpecificQuestions: 0,
        currentSurveyAudioSource: null,
        isSavingSurveyResponses: false,
        surveyAudioPlayerBuffers: {},
        surveyAudioLoading: false,
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
      setSurveyQuestions(numGeneralQuestions, numSpecificQuestions = 0) {
        this.numSurveyGeneralQuestions = numGeneralQuestions;
        this.numSurveySpecificQuestions = numSpecificQuestions;
      },
      setCurrentSurveyAudioSource(audioSource) {
        this.currentSurveyAudioSource = audioSource;
      },
      setIsSavingSurveyResponses(isSaving) {
        this.isSavingSurveyResponses = isSaving;
      },
      setSurveyAudioPlayerBuffers(buffers) {
        this.surveyAudioPlayerBuffers = buffers;
      },
      setSurveyAudioLoading(loading) {
        this.surveyAudioLoading = loading;
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
