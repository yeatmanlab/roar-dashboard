import { defineStore } from 'pinia';
import { csvFileToJson, standardDeviation } from '@/helpers'; // Assuming these are typed in helpers/index.ts

// Interfaces for data structures (adjust based on actual data)
interface Identifier {
  pid: string;
  'name.first'?: string;
  'name.middle'?: string;
  'name.last'?: string;
  grade?: string | number;
  dob?: string; // Assuming date of birth is a string
  [key: string]: any; // Allow other identifier fields
}

interface RunData {
  taskId: string;
  pid: string;
  runId: string; // Assuming runId exists
  timeStarted: string; // Assuming timeStarted is a string
  thetaEstimate?: number;
  grade?: string | number;
  blockId?: string;
  attempted?: number;
  correct?: number;
  incorrect?: number;
  [key: string]: any; // Allow other run data fields
}

interface MergedRunData extends RunData, Identifier {
  name: {
    first?: string;
    middle?: string;
    last?: string;
  };
}

interface RunInfoCommon {
  parsedGrade: string;
  roarScore: number;
  normedPercentile: number;
  supportLevel: string;
}

interface SubScore {
  runInfoOrig: MergedRunData;
  runInfoCommon?: RunInfoCommon; // Optional as it's added conditionally
  // runInfoTask?: any; // Placeholder if needed
}

interface ComputedScore extends MergedRunData { // Or a more specific type based on getRunScores
  runInfoCommon?: RunInfoCommon;
  blockId?: string; // Added by getRunScores
  // Add other properties added by getRunScores if any
}

interface AgeInfo {
  ageMonths: number;
  ageYears: number;
}

interface AgeStats {
  ageMin: number;
  ageMax: number;
  ageMean: string; // .toFixed(1) returns string
}

interface GradeStats {
  gradeMin: string;
  gradeMax: string;
  hasFirstOrK: boolean;
}

interface SupportStats {
  High: number | string; // Initially '', then number
  Medium: number | string;
  Low: number | string;
}

interface RoarScoreStats {
    roarScoreMin: number;
    roarScoreMax: number;
    roarScoreMean: number;
    roarScoreStandardDev: string; // .toFixed(0) returns string
}

interface SwrStats extends AgeStats, GradeStats, RoarScoreStats {
  numStudents: number;
  support: SupportStats;
  automaticity: SupportStats; // Assuming similar structure to supportStats
}

interface ScoreState {
  appScores: RunData[];
  identifiers: Identifier[];
  sections: any[]; // Type based on what csvFileToJson returns
  selectedStudentId: string | null;
}

// Helper Functions with Types
const standardizeTaskId = (taskId: string): string => {
  return taskId.replace(/^roar-/, '');
};

const standardizeNames = (run: Identifier): { first?: string; middle?: string; last?: string } => {
  return {
    first: run['name.first'],
    middle: run['name.middle'],
    last: run['name.last'],
  };
};

const getRunInfoCommon = (mergedRun: MergedRunData): RunInfoCommon | undefined => {
  let normedPercentile: number;
  const parsedGrade = parseGrade(mergedRun.grade);

  // note: new fields should be added to all cases
  switch (mergedRun.taskId) {
    case 'swr':
      // Ensure thetaEstimate exists and is a number before using it
      normedPercentile = mergedRun.thetaEstimate !== undefined ? woodcockJohnsonLookup(mergedRun.thetaEstimate) : 0;
      return {
        parsedGrade: parsedGrade,
        roarScore: mergedRun.thetaEstimate !== undefined ? thetaToRoarScore(mergedRun.thetaEstimate) : 0,
        normedPercentile: normedPercentile,
        supportLevel: percentileToSupportClassification('swr', normedPercentile, mergedRun.grade),
      };

    case 'pa':
      normedPercentile = 0; // Placeholder value
      return {
        parsedGrade: parsedGrade,
        roarScore: 0, // Placeholder value
        normedPercentile: normedPercentile,
        supportLevel: percentileToSupportClassification('pa', normedPercentile, mergedRun.grade),
      };

    case 'sre':
    case 'vocab':
    default:
      console.log('TODO: add', mergedRun.taskId, ' to getRunInfoCommon()');
      return undefined; // Explicitly return undefined for unhandled cases
  }
};

export function thetaToRoarScore(thetaEstimate: number): number {
  return Math.round(100 * (thetaEstimate + 5));
}

function differenceInMonths(date1: Date, date2: Date): number {
  const monthDiff = date1.getMonth() - date2.getMonth();
  const yearDiff = date1.getFullYear() - date2.getFullYear(); // Use getFullYear for accuracy
  return monthDiff + yearDiff * 12;
}

export function computeAges(dob: string | undefined, timeStarted: string | undefined): AgeInfo | null {
  if (!dob || !timeStarted) {
    return null; // Handle cases where dob or timeStarted might be missing
  }
  //const timeStartedDate = str.match(/(\d{1,4}([.\-/])\d{1,2}([.\-/])\d{1,4})/g);
  const timeStartedDateStr = timeStarted.substring(0, 10);
  const dateOfBirth = new Date(dob);
  const dateOfRun = new Date(timeStartedDateStr);

  if (isNaN(dateOfBirth.getTime()) || isNaN(dateOfRun.getTime())) {
      console.warn('Invalid date format for dob or timeStarted:', dob, timeStarted);
      return null; // Handle invalid date parsing
  }

  const ageMonths = differenceInMonths(dateOfRun, dateOfBirth);
  const ageYears = parseFloat((ageMonths / 12).toFixed(1));

  return { ageMonths, ageYears };
}

export function parseGrade(grade: string | number | undefined | null): string {
    if (grade === null || grade === undefined || grade === '') {
      return 'NA';
    }

    const gradeStr = String(grade).trim().toLowerCase();

    if (gradeStr === 'k') return 'k';
    if (gradeStr === 'tk' || gradeStr.startsWith('trans')) return 'tk';
    if (gradeStr.includes('p')) return 'pk'; // Assuming 'p' implies pre-k
    if (gradeStr.includes('j')) return 'jk'; // Assuming 'j' implies junior-k
    if (gradeStr.startsWith('kin')) return 'k';
    if (gradeStr === 'adult') return 'adult';

    const gradeNum = parseInt(gradeStr, 10);
    if (!isNaN(gradeNum)) {
      if (gradeNum < 0) return 'pk';
      if (gradeNum === 0) return 'k';
      if (gradeNum >= 1 && gradeNum <= 12) return String(gradeNum);
      return 'adult'; // Or handle numbers > 12 differently?
    }

    console.warn(grade, 'not recognized as a grade');
    return String(grade); // Return original string if unparseable
}


export function thetaToSupportSWR(percentile: number, grade: string | number | undefined | null): string {
  let support: string;
  const parsedGrade = parseGrade(grade).toLowerCase(); // Normalize grade

  if (parsedGrade === 'k' || parsedGrade === '1') {
    support = percentile < 50 ? 'Limited' : 'Average or Above Average';
  } else {
    support =
      percentile < 25 ? 'Extra Support Needed' : percentile < 50 ? 'Some Support Needed' : 'Average or Above Average';
  }
  return support;
}

export function woodcockJohnsonLookup(thetaEstimate: number): number {
  // TODO_Adam replace this totally fake calculation with a real lookup table based on thetaEstimate and ageMonths
  console.log('WARNING: fake woodcockJohnsonLookup still in use');
  // Ensure calculation result is a number
  return Math.round((100 * (thetaEstimate + 4)) / 8);
}

export function percentileToSupportClassification(taskId: string, percentile: number, grade: string | number | undefined | null = 1): string {
  let support = '';
  const parsedGrade = parseGrade(grade).toLowerCase(); // Normalize grade

  switch (taskId) {
    case 'pa':
      // Use numeric comparison for grades where possible
      const gradeNum = parseInt(parsedGrade, 10);
      if (parsedGrade === 'k' || (!isNaN(gradeNum) && gradeNum <= 4)) {
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
      if (parsedGrade === 'k' || parsedGrade === '1') {
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
      // Return a default value or handle appropriately
      support = 'Not Applicable';
      break;

    default:
      console.log(taskId, 'missing from switch statement');
      support = 'Unknown Task';
  }

  return support;
}

export function countItems(): number { // Added return type
  /*   //TODO_Adam -- how do I make the first param be treated as an array?
  let count = dataArray.reduce((n, x) => n + (x === searchValue), 0);
  return(count); */
  return 0; // TODO temp
}

const gradeComparator = (a: string, b: string): number => {
  const order: string[] = ['pk', 'jk', 'tk', 'k', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'adult'];

  const indexA = order.indexOf(a);
  const indexB = order.indexOf(b);

  // Handle cases where one or both grades are not in the order array
  if (indexA === -1 && indexB === -1) {
      // Try numerical comparison if possible
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b); // Fallback to string comparison
  }
  if (indexA === -1) return 1; // Unknown grades go last
  if (indexB === -1) return -1; // Unknown grades go last

  return indexA - indexB;
};


const getRunScores = (subScoresForThisRun: SubScore[]): ComputedScore | null => { // Adjusted return type
    if (!subScoresForThisRun || subScoresForThisRun.length === 0) {
      return null; // Handle empty input
    }

    // Use optional chaining and provide default for taskId extraction
    const taskIds = subScoresForThisRun.map((subScore) => subScore?.runInfoOrig?.taskId);
    const uniqueTaskIds = [...new Set(taskIds.filter(id => id))]; // Filter out undefined/null

    if (uniqueTaskIds.length !== 1) {
        console.error("Multiple or no task IDs found for this run:", uniqueTaskIds);
        // Handle error: maybe return null or a default object
        return null;
    }
    const taskId = uniqueTaskIds[0];

    // Use optional chaining for runInfoOrig access
    const runInfoOrigBase = subScoresForThisRun[0]?.runInfoOrig;
    if (!runInfoOrigBase) {
        console.error("First subscore or runInfoOrig is missing");
        return null;
    }


    switch (taskId) {
      case 'pa': {
        const paSubScores = subScoresForThisRun
          .map((subScore) => subScore.runInfoOrig)
          // Ensure blockId exists and is a string before calling toUpperCase
          .filter((runInfo) => typeof runInfo?.blockId === 'string' && ['FSM', 'LSM', 'DEL'].includes(runInfo.blockId.toUpperCase()));

        if (paSubScores.length === 0) {
            console.warn("No valid PA subscores found for run:", runInfoOrigBase.runId);
            // Return a default structure or null, depending on desired behavior
             return {
                ...runInfoOrigBase,
                blockId: 'total',
                attempted: 0,
                correct: 0,
                incorrect: 0,
                runInfoCommon: getRunInfoCommon(runInfoOrigBase as MergedRunData) // Recalculate common info if needed
             };
        }

        // Ensure initial paScore has necessary properties typed or initialized
        const paScore: Partial<ComputedScore> & { attempted: number; correct: number; incorrect: number } = {
            ...paSubScores[0], // Start with the first subscore's data
            attempted: 0,
            correct: 0,
            incorrect: 0,
        };

        ['attempted', 'correct', 'incorrect'].forEach((scoreType: keyof typeof paScore) => {
          const total = paSubScores.reduce((a, b) => {
            // Provide default value 0 if scoreType is missing or not a number
            const valB = typeof b[scoreType as keyof RunData] === 'number' ? b[scoreType as keyof RunData] : 0;
            return a + valB;
          }, 0);
          // Type assertion needed here if scoreType keys don't perfectly match
          (paScore as any)[scoreType] = total;
        });

        return {
          ...paScore, // Spread calculated totals
          ...runInfoOrigBase, // Ensure all original fields are present
          blockId: 'total',
          runInfoCommon: getRunInfoCommon(runInfoOrigBase as MergedRunData) // Get common info
        } as ComputedScore;
      }

      case 'swr':
        // Assume there is only one subscore for SWR
        // Ensure the returned object matches ComputedScore structure
        const swrSubScore = subScoresForThisRun[0];
        return {
            ...swrSubScore.runInfoOrig,
            runInfoCommon: swrSubScore.runInfoCommon
        } as ComputedScore;


      case 'sre': {
        // Ensure blockId exists and is a string before calling toUpperCase and includes
        const sreSubScores = subScoresForThisRun.filter((subScore) =>
            typeof subScore?.runInfoOrig?.blockId === 'string' &&
            ['LAB', 'TOSREC'].includes(subScore.runInfoOrig.blockId.toUpperCase()) // Use includes instead of contains
        );

        if (sreSubScores.length === 0) {
            console.warn("No valid SRE subscores found for run:", runInfoOrigBase.runId);
             return {
                ...runInfoOrigBase,
                blockId: 'total',
                attempted: 0,
                correct: 0,
                incorrect: 0,
                runInfoCommon: getRunInfoCommon(runInfoOrigBase as MergedRunData) // Recalculate common info if needed
             };
        }

        const sreScore: Partial<ComputedScore> & { attempted: number; correct: number; incorrect: number } = {
             ...sreSubScores[0]?.runInfoOrig, // Use optional chaining
             attempted: 0,
             correct: 0,
             incorrect: 0
        };


        ['attempted', 'correct', 'incorrect'].forEach((scoreType: keyof typeof sreScore) => {
            // Use optional chaining and default values
            (sreScore as any)[scoreType] = sreSubScores.reduce((a, b) => a + (Number(b?.runInfoOrig?.[scoreType as keyof RunData]) || 0), 0);
        });

        sreScore.blockId = 'total';
        sreScore.runInfoCommon = getRunInfoCommon(runInfoOrigBase as MergedRunData); // Get common info


        return sreScore as ComputedScore;
      }

      case 'vocab':
        console.log('TODO add sre and vocab cases');
        // Return a default or null for consistency
         return {
            ...runInfoOrigBase,
            runInfoCommon: getRunInfoCommon(runInfoOrigBase as MergedRunData) // Recalculate common info if needed
         } as ComputedScore;


      default:
        console.log(taskId, 'missing from switch statement in getRunScores');
        // Return a default or null
         return {
            ...runInfoOrigBase,
            runInfoCommon: getRunInfoCommon(runInfoOrigBase as MergedRunData) // Recalculate common info if needed
         } as ComputedScore;
    }
};

export const useScoreStore = defineStore('scoreStore', {
    state: (): ScoreState => ({
      appScores: [],
      identifiers: [],
      sections: [],
      selectedStudentId: null,
    }),
    getters: {
      // Ensure state type is provided
      taskId: (state: ScoreState): string | undefined => {
        if (!state.appScores || state.appScores.length === 0) {
          return undefined;
        }
        // Filter out potential null/undefined taskIds before creating the Set
        const taskIds = state.appScores.map((row) => row?.taskId).filter(id => id != null);
        const uniqueTaskIds = [...new Set(taskIds)];
        if (uniqueTaskIds.length > 1) {
           console.warn("Multiple task IDs found in appScores:", uniqueTaskIds);
           // Decide how to handle multiple task IDs - return the first? undefined?
           return uniqueTaskIds[0];
        }
        return uniqueTaskIds[0];
      },

      reportType: (): string | null => { // Define return type
        // Lots of complicated logic in here to determine the report type.
        // Options might include
        // SWR
        // PA
        // A mix of the above
        return null;
      },

      // Use `this` context for accessing other getters
      scoresReady(): boolean {
        return this.scores.length > 0;
      },

      subScores: (state: ScoreState): SubScore[] => {
        // If identifiers were not uploaded, simply return the appScores
        if (state.identifiers.length === 0) {
          //return { runInfoOrig: state.appScores};
          return state.appScores.map((run) => {
            const taskId = standardizeTaskId(run.taskId);
            // Construct the object matching the SubScore interface
            return {
              runInfoOrig: {
                ...run,
                taskId,
              } as MergedRunData, // Cast to MergedRunData (might lack identifier fields)
              // runInfoCommon and runInfoTask are undefined here
            };
          });
        } else {
          // Try to match appScores with the identifiers, matching on pid
          return state.appScores.map((run) => {
            const matchingIdentifier = state.identifiers.find((participant) => participant.pid === run.pid); // Use find for single match
            const taskId = standardizeTaskId(run.taskId);

            if (!matchingIdentifier) {
              return {
                runInfoOrig: {
                  ...run,
                  taskId,
                } as MergedRunData,
              };
            } else {
              const names = standardizeNames(matchingIdentifier);
              const mergedRun: MergedRunData = {
                ...run,
                ...matchingIdentifier,
                name: names,
                taskId,
              };
              return {
                runInfoOrig: mergedRun,
                runInfoCommon: getRunInfoCommon(mergedRun),
                // runInfoTask: getRunInfoTask(mergedRun), // Uncomment and implement if needed
              };
            }
          });
        }
      },

      // Use `this` to access other getters like subScores
      scores(): ComputedScore[] {
        if (!this.subScores || this.subScores.length === 0) return [];

        // Filter out subScores without runId before creating the Set
        const validSubScores = this.subScores.filter(subScore => subScore?.runInfoOrig?.runId);
        const uniqueRunIds = [...new Set(validSubScores.map((subScore) => subScore.runInfoOrig.runId))];

        return uniqueRunIds.map((runId) => {
          const subScoresForThisRun = validSubScores.filter((subScore) => subScore.runInfoOrig.runId === runId);
          const computedScore = getRunScores(subScoresForThisRun);
          // Ensure getRunScores doesn't return null here, or handle it
          return computedScore!;
        }).filter((score): score is ComputedScore => score !== null); // Filter out any null results
      },

      // Use `this` to access other getters like scores
      ageStats(): AgeStats | null {
        if (!this.scores || this.scores.length === 0) {
            return null;
        }
        const ages = this.scores
            .map(score => score?.runInfoOrig?.dob && score?.runInfoOrig?.timeStarted ? computeAges(score.runInfoOrig.dob, score.runInfoOrig.timeStarted) : null)
            .filter((ageInfo): ageInfo is AgeInfo => ageInfo !== null); // Filter out nulls

        if (ages.length === 0) {
          return null;
        }

        const ageYears = ages.map((age) => age.ageYears);
         if (ageYears.length === 0) { // Double check after filtering
            return null;
        }

        return {
          ageMin: Math.min(...ageYears),
          ageMax: Math.max(...ageYears),
          ageMean: (ageYears.reduce((a, b) => a + b, 0) / ages.length).toFixed(1),
        };
      },

      // Use `this` to access other getters like scores
      gradeStats(): GradeStats | null {
         if (!this.scores || this.scores.length === 0) {
            return null;
        }
        const parsedGrades = this.scores
            .map((score) => parseGrade(score?.runInfoOrig?.grade))
            .filter(grade => grade !== 'NA'); // Filter out 'NA' grades if needed

        if (parsedGrades.length === 0) {
          return null;
        }

        const hasFirstOrK =
          parsedGrades.includes('k') ||
          parsedGrades.includes('pk') ||
          parsedGrades.includes('tk') ||
          parsedGrades.includes('jk') ||
          parsedGrades.includes('1');

        return {
          gradeMin: parsedGrades.reduce((prev, curr) => {
            return gradeComparator(curr, prev) === -1 ? curr : prev; // Corrected comparator logic
          }, parsedGrades[0]), // Provide initial value
          gradeMax: parsedGrades.reduce((prev, curr) => {
            return gradeComparator(curr, prev) === 1 ? curr : prev; // Corrected comparator logic
          }, parsedGrades[0]), // Provide initial value
          hasFirstOrK: hasFirstOrK,
        };
      },

      // Use `this` to access other getters
      swrStats(state: ScoreState): SwrStats | null { // Pass state explicitly if not using `this`
        const ageStats = this.ageStats;
        const gradeStats = this.gradeStats;
        const roarScoreStats = this.roarScoreStats;
        const supportStats = this.supportStats;
        const swrAutomaticityStats = this.swrAutomaticityStats;

        // Check if all necessary stats are available
        if (!ageStats || !gradeStats || !roarScoreStats || !supportStats || !swrAutomaticityStats) {
            return null;
        }

        return {
          numStudents: this.scores.length, // Use `this.scores`
          ...ageStats,
          ...gradeStats,
          ...roarScoreStats,
          support: { ...supportStats },
          automaticity: { ...swrAutomaticityStats },
        };
      },

      // Use `this` to access state and other getters
      supportStats(): SupportStats {
        let stats: SupportStats = {
          High: 0, // Initialize with 0 instead of ''
          Medium: 0,
          Low: 0,
        };
        // Check identifiers length using state directly or this.identifiers
        if (this.identifiers.length === 0) {
          return stats;
        }
         // Use `this.scores` which already incorporates merged data
        const supportArray = this.scores
            .map((run) => run?.runInfoCommon?.supportLevel)
            .filter((level): level is string => typeof level === 'string'); // Ensure we have valid strings

        if (supportArray.length === 0) {
          return stats;
        }

        stats.High = supportArray.filter((x) => x === 'Average or Above Average').length;
        stats.Medium = supportArray.filter((x) => x === 'Some Support Needed').length;
        stats.Low = supportArray.filter((x) => x === 'Extra Support Needed').length;

        return stats;
      },

      // Use `this` to access state and other getters
      swrAutomaticityStats(): SupportStats {
         let stats: SupportStats = {
            High: 0, // Initialize with 0
            Medium: 0, // Adding Medium for consistency, although original code didn't use it here
            Low: 0,
         };
        // Check identifiers length using state directly or this.identifiers
        if (this.identifiers.length === 0) {
          return stats;
        }
         // Use `this.scores` which already incorporates merged data
        const supportArray = this.scores
            .map((run) => run?.runInfoCommon?.supportLevel)
            .filter((level): level is string => typeof level === 'string'); // Ensure we have valid strings

        if (supportArray.length === 0) {
          return stats;
        }

        // Update values based on SWR specific logic (if applicable, otherwise use standard support levels)
        // The original code here seems to duplicate supportStats logic for High/Low categories
        stats.High = supportArray.filter((x) => x === 'Average or Above Average').length;
        stats.Low = supportArray.filter((x) => x === 'Limited').length; // Specific to SWR K/1 grade

        return stats;
      },


      // Use `this` to access other getters like scores
      roarScoreStats(state: ScoreState): RoarScoreStats | null {
        if (!this.scores || this.scores.length === 0) {
            return null; // Return null if scores array is empty or undefined
        }
        const roarScoresArray = this.scores
            .map(score => score?.runInfoCommon?.roarScore)
            .filter((score): score is number => typeof score === 'number'); // Filter out non-numbers

        if (roarScoresArray.length === 0) {
             // Handle case where no valid roar scores are found
            return {
                roarScoreMin: NaN,
                roarScoreMax: NaN,
                roarScoreMean: NaN,
                roarScoreStandardDev: 'NaN',
            };
        }

        const sum = roarScoresArray.reduce((a, b) => a + b, 0);
        const mean = sum / roarScoresArray.length;

        // Ensure standardDeviation function handles empty or single-element arrays gracefully
        const stdDev = standardDeviation(roarScoresArray);

        return {
          roarScoreMin: Math.min(...roarScoresArray),
          roarScoreMax: Math.max(...roarScoresArray),
          roarScoreMean: Math.round(mean),
          // Check if stdDev is NaN before calling toFixed
          roarScoreStandardDev: isNaN(stdDev) ? 'N/A' : stdDev.toFixed(0),
        };
      },
    },

    actions: {
      // Type the csvFile parameter (assuming it's a File object)
      async mergeSectionsWithIdentifiers(csvFile: File) {
        try {
            // Assuming csvFileToJson returns Promise<any[]> or a more specific type
            const sectionsData: any[] = await csvFileToJson(csvFile);
            console.log(sectionsData);
            this.sections = sectionsData; // Assign typed data
            // TODO: Implement merge logic with this.identifiers
        } catch (error: any) {
            console.error("Error processing CSV file:", error);
            // Handle error appropriately
        }
      },
      // Example for assignRiskCategories (uncommented and typed)
      // assignRiskCategories(scoreField: keyof ComputedScore, cutoffs: { category: string, lowerBound: number, upperBound: number }[]) {
      //   this.scores = this.scores.map((run) => {
      //     const scoreValue = run[scoreField];
      //     if (typeof scoreValue === 'number') {
      //       const category = cutoffs.find(cat => scoreValue >= cat.lowerBound && scoreValue < cat.upperBound);
      //       return {
      //         ...run,
      //         riskCategory: category ? category.category : 'Undefined' // Add a new property
      //       };
      //     }
      //     return run; // Return unmodified if scoreField is not a number
      //   });
      // }
    },
});

// HMR (Hot Module Replacement)
// Note: Pinia's defineStore returns the hook function directly now.
// The HMR logic might need adjustment depending on your Vite/Vue setup.
// The standard pattern is usually outside the function definition.

// export const useScoreStore = createdStore; // If the above doesn't work directly

// if (import.meta.hot) {
//   import.meta.hot.accept(acceptHMRUpdate(useScoreStore, import.meta.hot));
// } 