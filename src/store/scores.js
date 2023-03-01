import { defineStore } from "pinia";
import { csvFileToJson, standardDeviation } from "@/helpers";

export const useScoreStore = () => {
  return defineStore({
    id: "scoreStore",
    state: () => {
      return {
        appScores: [],
        identifiers: [],
        sections: [],
        selectedStudentId: null,
      };
    },
    getters: { 
      taskId: (state) => {
        // TODO: Add error handling to check that there is only one taskId
        return [...new Set(state.appScores.map((row) => row?.taskId))][0];
      },
      reportType: (state) => {
        // Lots of complicated logic in here to determine the report type.
        // Options might include
        // SWR
        // PA
        // A mix of the above
        return null;
      },
      scoresReady: (state) => state.scores.length > 0,
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
      ages: (state) => {
        const ages = state.scores.map((score) => score.age);
        if (ages.length === 0) {
          return null;
        }
        return {
          ages: ages,
          mean: ages.reduce((a, b) => a + b) / ages.length,
        };
      },
      grades: (state) => {
        const gradesArray = state.scores.map((score) => score.grade);
        return {
          grades: gradesArray,
          min: Math.min(...gradesArray),
          max: Math.max(...gradesArray),
        };
      },
      // TODO: thetaEstimate should be changed to ROAR score
      roarScores: (state) => {
        const roarScoresArray = state.scores.map((score) => score.thetaEstimate);
        const filterScores = 0;
        if (roarScoresArray.length === 0) {
          return {
            scores: roarScoresArray,
            min: null,
            max: null,
            mean: null,
            sd: null,
          };
        } else {
          return {
            scores: roarScoresArray,
            min: Math.min(...roarScoresArray),
            max: Math.max(...roarScoresArray),
            mean: roarScoresArray.reduce((a, b) => a + b) / roarScoresArray.length,
            sd: standardDeviation(roarScoresArray),
          };
        }
      },
      classifications: (state) => {
        return {
          support: {
            high: null,
            medium: null,
            low: null,
          },
          automaticity: {
            high: null,
            low: null,
          }
        }


      }
    },
    actions: {
      mergeSectionsWithIdentifiers: async (csvFile) => {
        const sectionsData = await csvFileToJson(csvFile);
        console.log(sectionsData);
        this.sections = sectionsData;
        // Do stuff to sectionsData
        // merge with this.identifiers
      },
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
