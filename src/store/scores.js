import { defineStore } from "pinia";
import { csvFileToJson, standardDeviation } from "@/helpers";

const getRunInfoCommon = (run) => {
  // note: new fields should be added to all cases
  let normedPercentile;
  switch(run.taskId) {
    case "swr":
      normedPercentile = woodcockJohnsonLookup(run.thetaEstimate);
      return { 
        roarScore: thetaToRoarScore(run.thetaEstimate),
        normedPercentile: normedPercentile,
        //supportLevel: thetaToSupportSWR(run.runInfoOrig.thetaEstimate, run.runInfoOrig.grade),


        // TODO_ADAM -- how do I pass normedPercentile to the function below?
        supportLevel: percentileToSupportClassification("swr", normedPercentile, run.grade),

      };
      break;

    case "pa":
    case "sre":
    case "vocab":
    default:
      console.log("TODO: add", run.taskId, " to getRunInfoCommon()");
      break;
  }

};

const getRunInfoTask =(run) => {
  switch(run.taskId) {
    case "swr":
      return processSWRRun(run);
      break;

    case "pa":
    case "sre":
    case "vocab":
    default:
      console.log("TODO: add", run.taskId, " to getTaskSpecificScores()");
      break;
  }
};


const processSWRRun =(run) => {
  return {    
    // fields that vary between tasks
    subScores: {
      // These subtask IDs will differ in between tasks
      fsm: Number,
      lsm: Number,
      del: Number,
    },

    comparisonPercentile: Number,
    comparisonType: "Woodcock Johnson",
    normedPercentile: Number,
    classifications: {
        // Here each field can differ depending on the task
        support: String,
        automaticity: String,
    }

  };

};

export function thetaToRoarScore (thetaEstimate) {
  return (Math.round(100 * (thetaEstimate + 5)));
};

function differenceInMonths(date1, date2) {
  const monthDiff = date1.getMonth() - date2.getMonth();
  const yearDiff = date1.getYear() - date2.getYear();

  return monthDiff + yearDiff * 12;
}
export function computeAges(dob, timeStarted) {
  //const timeStartedDate = str.match(/(\d{1,4}([.\-/])\d{1,2}([.\-/])\d{1,4})/g);
  let timeStartedDate = timeStarted.substring(0,10);
  let dateOfBirth = new Date(dob);
  let dateOfRun = new Date(timeStartedDate);

  let ageMonths = differenceInMonths(dateOfRun, dateOfBirth);
  let ageYears = parseFloat((ageMonths/12).toFixed(1));

  return { ageMonths, ageYears };
};

export function thetaToSupportSWR (percentile, grade) {
  let support;

  // we report automaticity instead of support for grades K/1 
  if ((grade == "K") || (grade == "1")) {
    support = (percentile < 50) ? "Limited" : "Average or Above Average";
  } else {
    support = (percentile < 25) ? "Extra Support Needed" : (percentile < 50) ? "Some Support Needed": "Average or Above Average";
  }
  //console.log(percentile, " ", grade, " ", support);
  return support;
};

export function woodcockJohnsonLookup (thetaEstimate) {
  // TODO replace this totally fake calculation with a real lookup table based on thetaEstimate and ageMonths
  return Math.round(100 * (thetaEstimate +4)/8);
};

export function percentileToSupportClassification(taskId, percentile, grade=1) {
  let support = "";

  switch(taskId) {
    case "pa":
      if ((grade == "K") || (grade <= "4")) {
        support = (percentile <= 25) ? "Extra Support Needed" : (percentile <= 50) ? "Some Support Needed": "Average or Above Average";
      } else {
        support = (percentile <= 15) ? "Extra Support Needed" : (percentile <= 30) ? "Some Support Needed": "Average or Above Average";
      }
      break;

    case "swr":
      if ((grade == "K") || (grade == "1")) {
        support = (percentile <= 50) ? "Limited" : "Average or Above Average";
      } else {
        support = (percentile <= 25) ? "Extra Support Needed" : (percentile <= 50) ? "Some Support Needed": "Average or Above Average";
      }
      break;

    case "sre":
    case "vocab":
      console.log("TODO add sre and vocab cases to percentileToSupportClassification() ")
      break;
  }

  return(support);
};

export function debugTestFunction () {
  return {
    field1: 'true',
    field2: 'false',
  };
};

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

      debugTempVariable: (state) => 'false',
      debugTempContainer: (state) => {
        return {
          showDebug: 'false',
          fromFunction: debugTestFunction(),
        }
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
          //return { runInfoOrig: state.appScores}; 
          return state.appScores.map((run) => {
            return {
              // original, unaltered, run-level info from the databases (no identifiers)
              runInfoOrig: { 
                ...run,
               },
            };
          })
        } else {
          // Try to match appScores with the identifiers, matching on pid
          return state.appScores.map((run) => {
            const matchingIdentifier = state.identifiers.filter((participant) => 
              participant.pid === run.pid
            );
            if (matchingIdentifier.length === 0) {
              //return state.run;
              return {
                // original, unaltered, run-level info from the databases (no identifiers)
                runInfoOrig: { 
                  ...run,
                 },
              };
            } else {
              const mergedRun = {
                        ...run,
                        ...matchingIdentifier[0]
                      };
              return {
                // original, unaltered, run-level info and identifiers from the databases
                runInfoOrig: mergedRun,

                // computed values common to all tasks
                runInfoTest: getRunInfoCommon(mergedRun),

                // TODO move these into getRunInfoCommon:
                runInfoCommon: {
                  roarScore: thetaToRoarScore(run.thetaEstimate),
                  normedPercentile: woodcockJohnsonLookup(run.thetaEstimate),
                  grade: matchingIdentifier[0].grade,
                  supportLevel: thetaToSupportSWR(woodcockJohnsonLookup(run.thetaEstimate), matchingIdentifier[0].grade)
                },
 
                // computed values unique to each task
                //runInfoTask: getRunInfoTask(run),
              }
            }
          })
        }
      },

/*       runInfoCommon: (state) => {
        const runs = state.scores.map((score) => score.runInfoOrig);
        if (runs.length === 0) {
          return null;
        } else {
          return getRunInfoCommon(runs);
        };
      }, */

      ageStats: (state) => {
        const ages = state.scores.map((score) => computeAges(score.runInfoOrig.dob, score.runInfoOrig.timeStarted)); 

        if (ages.length === 0) {
          return null;
        }

        const ageYears = ages.map((age) => age.ageYears);
        const ageMonths = ages.map((age) => age.ageMonths);
        console.log(ageYears[0],ageMonths[0]);
        return {
          ages: ages,
          ageYearArray: ageYears,

          ageMin: Math.min(...ageYears),
          ageMax: Math.max(...ageYears),
          ageMean: (ageYears.reduce((a, b) => a + b) / ages.length).toFixed(1),
        };
      },
      gradeStats: (state) => {
        // TODO utility function handle "Kindergarten"
        const grades = state.scores.map((score) => score.runInfoOrig.grade); 
        if (grades.length === 0) {
          return null;
        }
        return {
          grades: grades,
          gradeMin: Math.min(...grades),
          gradeMax: Math.max(...grades),

        };
      },

      swrStats: (state) => { 
        return { 
/*           numStudents: state.scores.length,
          ageMin: Number,
          ageMax: Number,
          ageMean: Number,
          gradeMin: Number,
          gradeMax: Number,
          roarScoreMin: Number,
          roarScoreMax: Number,
          roarScoreMean: Number,
          roarScoreStdDev: Number,
          support: {
            high: null,
            medium: null,
            low: null,
          },
          automaticity: {
            high: null,
            low: null,
          }, */
          ...state.ageStats,
          ...state.gradeStats,
          ...state.roarScoreStats,

        };
      },

      roarScoreStats: (state) => {
        const roarScoresArray = state.scores.map((score) => thetaToRoarScore(score.runInfoOrig.thetaEstimate));
        return {
          // Note: all calculations must gracefully handle an array length of 0
          roarScoreMin: Math.min(...roarScoresArray),
          roarScoreMax: Math.max(...roarScoresArray),
          roarScoreMean: Math.round(roarScoresArray.reduce((a, b) => a + b,0) / roarScoresArray.length),
          roarScoreStandardDev: standardDeviation(roarScoresArray).toFixed(0),
        };
      },

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
