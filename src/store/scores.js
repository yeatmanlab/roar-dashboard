import { defineStore } from "pinia";

export const useScoreStore = () => {
  return defineStore({
    id: "scoreStore",
    state: () => {
      return {
        scores: [],
      };
    },
    getters: { 
      taskId: (state) => {
        // TODO: Add error handling to check that there is only one taskId
        return [...new Set(state.scores.map((row) => row?.taskId))][0];
      }
    },
    actions: { },
  })();
};
