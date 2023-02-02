import { defineStore } from "pinia";
import { standardDeviation } from "@/helpers";

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
      },
      numStudents: (state) => state.scores.length,
      ageMean: (state) => {
        const ages = state.scores.map((score) => score.age);
        return ages.reduce((a, b) => a + b) / ages.length;
      },
      grades: (state) => state.scores.map((score) => score.grade),
      gradeMin: (state) => Math.min(...state.grades),
      gradeMax: (state) => Math.max(...state.grades),
      // TODO: thetaEstimate should be changed to ROAR score
      roarScores: (state) => state.scores.map((score) => score.thetaEstimate),
      roarScoreMean: (state) => state.roarScores.reduce((a, b) => a + b) / state.roarScores.length,
      roarScoreMin: (state) => Math.min(...state.roarScores),
      roarScoreMax: (state) => Math.max(...state.roarScores),
      roarScoreSD: (state) => standardDeviation(state.roarScores),
      // numStudentsAboveAverage: (state) =>
      // numStudentsNeedSomeSupport: (state) =>
      // numStudentsNeedExtraSupport: (state) =>
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
