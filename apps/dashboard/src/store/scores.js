import { defineStore } from 'pinia';
import { csvFileToJson, standardDeviation } from '@/helpers';

const standardizeTaskId = (taskId) => {
  return taskId.replace(/^roar-/, '');
};
const standardizeNames = (run) => {
  return {
    first: run['name.first'],
    middle: run['name.middle'],
    last: run['name.last'],
  };
};

const getRunInfoCommon = (mergedRun) => {
  let normedPercentile;
  let parsedGrade = parseGrade(mergedRun.grade);

  // note: new fields should be added to all cases
  switch (mergedRun.taskId) {
    case 'swr':
      normedPercentile = woodcockJohnsonLookup(mergedRun.thetaEstimate);
      return {
        parsedGrade: parsedGrade,
        roarScore: thetaToRoarScore(mergedRun.thetaEstimate),
        normedPercentile: normedPercentile,
        //supportLevel: thetaToSupportSWR(run.runInfoOrig.thetaEstimate, run.runInfoOrig.grade),
        supportLevel: percentileToSupportClassification('swr', normedPercentile, mergedRun.grade),
      };

    case 'pa':
      normedPercentile = 0;
      return {
        parsedGrade: parsedGrade,
        roarScore: 0,
        normedPercentile: normedPercentile,
        //supportLevel: thetaToSupportSWR(run.runInfoOrig.thetaEstimate, run.runInfoOrig.grade),
        supportLevel: percentileToSupportClassification('pa', normedPercentile, mergedRun.grade),
      };

    case 'sre':
    case 'vocab':
    default:
      console.log('TODO: add', mergedRun.taskId, ' to getRunInfoCommon()');
      break;
  }
};

// const getRunInfoTask = (mergedRun) => {
//   switch (mergedRun.taskId) {
//     case 'swr':
//       return processSWRRun(mergedRun);

//     case 'pa':
//     case 'sre':
//     case 'vocab':
//     default:
//       console.log(mergedRun.taskId, 'missing from switch');
//       break;
//   }
// };

// const processSWRRun = () => {
//   return {
//     // fields that vary between tasks
//     subScores: {
//       // These subtask IDs will differ in between tasks
//       fsm: Number,
//       lsm: Number,
//       del: Number,
//     },

//     comparisonPercentile: Number,
//     comparisonType: 'Woodcock Johnson',
//     normedPercentile: Number,
//     classifications: {
//       // Here each field can differ depending on the task
//       support: String,
//       automaticity: String,
//     },
//   };
// };

export function thetaToRoarScore(thetaEstimate) {
  return Math.round(100 * (thetaEstimate + 5));
}

function differenceInMonths(date1, date2) {
  const monthDiff = date1.getMonth() - date2.getMonth();
  const yearDiff = date1.getYear() - date2.getYear();

  return monthDiff + yearDiff * 12;
}
export function computeAges(dob, timeStarted) {
  //const timeStartedDate = str.match(/(\d{1,4}([.\-/])\d{1,2}([.\-/])\d{1,4})/g);
  let timeStartedDate = timeStarted.substring(0, 10);
  let dateOfBirth = new Date(dob);
  let dateOfRun = new Date(timeStartedDate);

  let ageMonths = differenceInMonths(dateOfRun, dateOfBirth);
  let ageYears = parseFloat((ageMonths / 12).toFixed(1));

  return { ageMonths, ageYears };
}

export function parseGrade(grade) {
  if (!grade) {
    // null, undefined, or empty string
    return 'NA';
  } else if (isNaN(grade)) {
    // parse as a string
    if (grade.toLowerCase() === 'k') {
      return 'k';
    } else if (grade.substring(0, 2).toLowerCase() === 'tk') {
      return 'tk';
    } else if (grade.toLowerCase().includes('trans')) {
      return 'tk';
    } else if (grade.toLowerCase().includes('p')) {
      return 'pk';
    } else if (grade.toLowerCase().includes('j')) {
      return 'jk';
    } else if (grade.substring(0, 3).toLowerCase() === 'kin') {
      return 'k';
    } else if (grade.toLowerCase() == 'adult') {
      return 'adult';
    } else if (!isNaN(parseInt(grade))) {
      // this catches strings like 1st, 2nd, 3rd
      let gradeNum = parseInt(grade);
      return gradeNum.toString();
    } else {
      console.warn(grade, 'not recognized as a grade');
      return grade.toString();
    }
  } else {
    // parse as a number
    let gradeNum = parseInt(grade);

    if (gradeNum < 0) {
      return 'pk';
    } else if (gradeNum === 0) {
      return 'k';
    } else if (gradeNum >= 1 && gradeNum <= 12) {
      return gradeNum.toString();
    } else {
      return 'adult';
    }
  }
}

export function thetaToSupportSWR(percentile, grade) {
  let support;

  // we report automaticity instead of support for grades K/1
  if (grade == 'K' || grade == '1') {
    support = percentile < 50 ? 'Limited' : 'Average or Above Average';
  } else {
    support =
      percentile < 25 ? 'Extra Support Needed' : percentile < 50 ? 'Some Support Needed' : 'Average or Above Average';
  }
  return support;
}

export function woodcockJohnsonLookup(thetaEstimate) {
  // TODO_Adam replace this totally fake calculation with a real lookup table based on thetaEstimate and ageMonths
  console.log('WARNING: fake woodcockJohnsonLookup still in use');
  return Math.round((100 * (thetaEstimate + 4)) / 8);
}

export function percentileToSupportClassification(taskId, percentile, grade = 1) {
  let support = '';

  switch (taskId) {
    case 'pa':
      if (grade == 'K' || grade <= '4') {
        support =
          percentile < 25
            ? 'Extra Support Needed'
            : percentile < 50
            ? 'Some Support Needed'
            : 'Average or Above Average';
      } else {
        support =
          percentile < 15
            ? 'Extra Support Needed'
            : percentile < 30
            ? 'Some Support Needed'
            : 'Average or Above Average';
      }
      break;

    case 'swr':
      // we report automaticity instead of support for grades K/1
      if (grade == 'K' || grade == '1') {
        support = percentile < 50 ? 'Limited' : 'Average or Above Average';
      } else {
        support =
          percentile < 25
            ? 'Extra Support Needed'
            : percentile < 50
            ? 'Some Support Needed'
            : 'Average or Above Average';
      }
      break;

    case 'sre':
    case 'vocab':
      console.log('TODO add sre and vocab cases to percentileToSupportClassification() ');
      break;

    default:
      console.log(taskId, 'missing from switch statement');
  }

  return support;
}

export function countItems() {
  /*   //TODO_Adam -- how do I make the first param be treated as an array?
  let count = dataArray.reduce((n, x) => n + (x === searchValue), 0);
  return(count); */
  return 0; // TODO temp
}

const gradeComparator = (a, b) => {
  const order = ['pk', 'jk', 'tk', 'k', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'adult'];

  if (a === b) {
    // equal inputs
    return 0;
  }

  let indexA = order.length;
  let indexB = order.length;

  if (order.includes(a)) {
    indexA = order.indexOf(a);
  }

  if (order.includes(b)) {
    indexB = order.indexOf(b);
  }

  if (indexA === indexB) {
    // neither input found
    if (a > b) return 1;
    else return -1;
  } else if (indexA > indexB) {
    // string a was later in the array
    return 1;
  } else {
    // b was later in the array
    return -1;
  }
};

const getRunScores = (subScoresForThisRun) => {
  const taskId = [...new Set(subScoresForThisRun.map((subScore) => subScore.runInfoOrig.taskId))][0];
  switch (taskId) {
    case 'pa': {
      const paSubScores = subScoresForThisRun
        .map((subScore) => subScore.runInfoOrig)
        .filter((subScore) => ['FSM', 'LSM', 'DEL'].includes(subScore.blockId.toUpperCase()));
      const paScore = { ...paSubScores[0] };
      ['attempted', 'correct', 'incorrect'].forEach((scoreType) => {
        const total = paSubScores.reduce((a, b) => {
          return a + b[scoreType];
        }, 0);
        paScore[scoreType] = total;
      });
      return {
        ...paScore,
        blockId: 'total',
      };
    }

    case 'swr':
      // Assume there is only one subscore for SWR
      return subScoresForThisRun[0];

    case 'sre': {
      // TODO: Confirm SRE blockId names
      const sreSubScores = subScoresForThisRun.filter((subScore) =>
        ['LAB', 'TOSREC'].contains(subScore.blockId.toUpperCase()),
      );
      const sreScore = sreSubScores[0];
      sreScore.blockId = 'total';
      ['attempted', 'correct', 'incorrect'].forEach((scoreType) => {
        sreScore[scoreType] = sreSubScores.reduce((a, b) => a[scoreType] + b[scoreType], 0);
      });
      return sreScore;
    }

    case 'vocab':
      console.log('TODO add sre and vocab cases');
      break;

    default:
      console.log(taskId, 'missing from switch statement');
  }
};

export const useScoreStore = () => {
  return defineStore({
    id: 'scoreStore',
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

      reportType: () => {
        // Lots of complicated logic in here to determine the report type.
        // Options might include
        // SWR
        // PA
        // A mix of the above
        return null;
      },

      scoresReady: (state) => state.scores.length > 0,
      subScores: (state) => {
        // If identifiers were not uploaded, simply return the appScores
        if (state.identifiers.length === 0) {
          //return { runInfoOrig: state.appScores};
          return state.appScores.map((run) => {
            const taskId = standardizeTaskId(run.taskId);
            return {
              // original, unaltered, run-level info from the databases (no identifiers)
              runInfoOrig: {
                ...run,
                taskId,
              },
            };
          });
        } else {
          // Try to match appScores with the identifiers, matching on pid
          return state.appScores.map((run) => {
            const matchingIdentifier = state.identifiers.filter((participant) => participant.pid === run.pid);
            const taskId = standardizeTaskId(run.taskId);
            if (matchingIdentifier.length === 0) {
              //return state.run;
              return {
                // original, unaltered, run-level info from the databases (no identifiers)
                runInfoOrig: {
                  ...run,
                  taskId,
                },
              };
            } else {
              const names = standardizeNames(matchingIdentifier[0]);
              const mergedRun = {
                ...run,
                ...matchingIdentifier[0],
                name: names,
                taskId,
              };
              return {
                // original, unaltered, run-level info and identifiers from the databases
                runInfoOrig: mergedRun,

                // computed values common to all tasks
                runInfoCommon: getRunInfoCommon(mergedRun),

                // compute values unique to each task
                //runInfoTask: getRunInfoTask(mergedRun),
              };
            }
          });
        }
      },
      scores: (state) => {
        const uniqueRunIds = [...new Set(state.subScores.map((subScore) => subScore.runInfoOrig.runId))];
        return uniqueRunIds.map((runId) => {
          const subScoresForThisRun = state.subScores.filter((subScore) => subScore.runInfoOrig.runId === runId);
          return {
            ...getRunScores(subScoresForThisRun),
          };
        });
      },

      ageStats: (state) => {
        const ages = state.scores.map((score) => computeAges(score.runInfoOrig.dob, score.runInfoOrig.timeStarted));
        if (ages.length === 0) {
          return null;
        }

        const ageYears = ages.map((age) => age.ageYears);
        return {
          ageMin: Math.min(...ageYears),
          ageMax: Math.max(...ageYears),
          ageMean: (ageYears.reduce((a, b) => a + b) / ages.length).toFixed(1),
        };
      },

      gradeStats: (state) => {
        const parsedGrades = state.scores.map((score) => parseGrade(score.runInfoOrig.grade));
        const hasFirstOrK =
          parsedGrades.includes('k') ||
          parsedGrades.includes('pk') ||
          parsedGrades.includes('tk') ||
          parsedGrades.includes('jk') ||
          parsedGrades.includes('1');

        if (parsedGrades.length === 0) {
          return null;
        }
        return {
          gradeMin: parsedGrades.reduce(function (prev, curr) {
            return gradeComparator(curr, prev) === 1 ? prev : curr;
          }),
          gradeMax: parsedGrades.reduce(function (prev, curr) {
            return gradeComparator(curr, prev) === 1 ? curr : prev;
          }),
          hasFirstOrK: hasFirstOrK,
        };
      },

      swrStats: (state) => {
        return {
          numStudents: state.scores.length,
          ...state.ageStats,
          ...state.gradeStats,
          ...state.roarScoreStats,
          support: { ...state.supportStats },
          automaticity: { ...state.swrAutomaticityStats },
        };
      },

      supportStats: (state) => {
        let stats = {
          // set defaults
          High: '',
          Medium: '',
          Low: '',
        };
        if (state.identifiers.length === 0) {
          // TODO_Adam how to test whether match was found, not just file loaded?
          return stats;
        }
        const supportArray = state.scores.map((run) => run.runInfoCommon.supportLevel);
        if (supportArray.length === 0) {
          return stats;
        }

        // update values
        stats.High = supportArray.filter((x) => x === 'Average or Above Average').length;
        stats.Medium = supportArray.filter((x) => x === 'Some Support Needed').length;
        stats.Low = supportArray.filter((x) => x === 'Extra Support Needed').length;

        return stats;
      },

      swrAutomaticityStats: (state) => {
        let stats = {
          // set defaults
          High: '',
          Low: '',
        };
        if (state.identifiers.length === 0) {
          // TODO_Adam how to test whether match was found, not just file loaded?
          return stats;
        }
        const supportArray = state.scores.map((run) => run.runInfoCommon.supportLevel);
        if (supportArray.length === 0) {
          return stats;
        }

        // update values
        stats.High = supportArray.filter((x) => x === 'Average or Above Average').length;
        stats.Low = supportArray.filter((x) => x === 'Limited').length;

        return stats;
      },

      roarScoreStats: (state) => {
        const roarScoresArray = state.scores.map((score) => thetaToRoarScore(score.runInfoOrig.thetaEstimate));
        return {
          // Note: all calculations must gracefully handle an array length of 0
          roarScoreMin: Math.min(...roarScoresArray),
          roarScoreMax: Math.max(...roarScoresArray),
          roarScoreMean: Math.round(roarScoresArray.reduce((a, b) => a + b, 0) / roarScoresArray.length),
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
