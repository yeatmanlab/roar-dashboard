import { defineStore } from "pinia";

export const useScoreStore = () => {
  return defineStore({
    id: "scoreStore",
    state: () => {
      return {
        appScores: [],
        identifiers: [],
      };
    },
    getters: { 
      taskId: (state) => {
        // TODO: Add error handling to check that there is only one taskId
        return [...new Set(state.appScores.map((row) => row?.taskId))][0];
      },
      scores: (state) => {
        // If identifiers were not uploaded, simply return the appScores
        if (state.identifiers.length === 0) {
          return state.appScores;
        } else {
          // Try to match appScores with the identifiers, matching on pid
          return state.appScores.map((run) => {
            const matchingIdentifier = state.identifiers.filter((participant) => 
              participant.pid === run.pid
            );
            if (matchingIdentifier.length === 0) {
              return run
            } else {
              return {
                ...run,
                ...matchingIdentifier[0],
              }
            }
          })
        }
      }
    },
    actions: {
      // assignRiskCategories: (scoreField, cutoffs) => {
      //   // Expect that cutoff is an array of objects with structure
      //   // { category: string, lowerBound: number, upperBound: number}
      //   this.scores = this.scores.map((run) => {
      //     ...run,
      //     cutoffs.filter((category) => category.lowerBound <= run[scoreField] && category.upperBound > run[scoreField])
      //   })
      // }
    },
  })();
};
