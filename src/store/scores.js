import { defineStore } from "pinia";

export const useScoreStore = () => {
  return defineStore({
    id: "scoreStore",
    state: () => {
      return {
        scores: [],
      };
    },
    getters: { },
    actions: { },
  })();
};
