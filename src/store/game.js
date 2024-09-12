import { defineStore } from 'pinia';
import { parse, stringify } from 'zipson';

export const useGameStore = () => {
  return defineStore({
    id: 'gameStore',
    state: () => {
      return {
        selectedAdmin: undefined,
        requireRefresh: false,
        // LEVANTE
        isSurveyCompleted: false,
        surveys: {},
      };
    },
    actions: {
      requireHomeRefresh() {
        this.requireRefresh = true;
      },
      setSurveyCompleted() {
        this.isSurveyCompleted = true;
      },
      setSurveys(surveys) {
        this.surveys = surveys;
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
