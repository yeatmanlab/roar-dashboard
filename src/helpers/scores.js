import _get from 'lodash/get'
import _map from 'lodash/map'
import _union from 'lodash/union'
import _forEach from 'lodash/forEach'
import { standardDeviation } from "@/helpers";

export const standardizeTaskId = (taskId) => {
  return taskId.replace(/^roar-/, "");
};

export const standardizeNames = (run) => {
  return {
    first: run['name.first'],
    middle: run['name.middle'],
    last: run['name.last']
  };
}

export const getRunInfoCommon = (mergedRun) => {
  let normedPercentile;
  let parsedGrade = parseGrade(mergedRun.grade);

  // note: new fields should be added to all cases
  switch(mergedRun.taskId) {
    case "swr":
      normedPercentile = woodcockJohnsonLookup(mergedRun.thetaEstimate);
      return { 
        parsedGrade: parsedGrade,
        roarScore: thetaToRoarScore(mergedRun.thetaEstimate),
        normedPercentile: normedPercentile,
        //supportLevel: thetaToSupportSWR(run.runInfoOrig.thetaEstimate, run.runInfoOrig.grade),
        supportLevel: percentileToSupportClassification("swr", normedPercentile, mergedRun.grade),
      };
      break;

    case "pa":
      normedPercentile = 0;
      return { 
        parsedGrade: parsedGrade,
        roarScore: 0,
        normedPercentile: normedPercentile,
        //supportLevel: thetaToSupportSWR(run.runInfoOrig.thetaEstimate, run.runInfoOrig.grade),
        supportLevel: percentileToSupportClassification("pa", normedPercentile, mergedRun.grade),
      };
      break;

    case "sre":
    case "vocab":
    default:
      console.log("TODO: add", mergedRun.taskId, " to getRunInfoCommon()");
      break;
  }

};

export function thetaToRoarScore (thetaEstimate) {
  return (Math.round(100 * (thetaEstimate + 5)));
};

export function differenceInMonths(date1, date2) {
  const monthDiff = date1.getMonth() - date2.getMonth();
  const yearDiff = date1.getYear() - date2.getYear();
  return monthDiff + yearDiff * 12;
}

export function computeAges(dob, timeStarted) {
  let dateOfBirth = new Date(dob);
  let dateOfRun = new Date(timeStarted);

  let ageMonths = differenceInMonths(dateOfRun, dateOfBirth);
  let ageYears = parseFloat((ageMonths/12).toFixed(1));

  return { ageMonths, ageYears };
};

export function parseGrade(grade) {
  if (!grade) {
    // null, undefined, or empty string
    return "NA";
  } else if (isNaN(grade)) {
    // parse as a string
    if (grade.toLowerCase() === "k") { 
      return("k");
    } else if (grade.substring(0,2).toLowerCase() === "tk") {
      return("tk");
    } else if (grade.toLowerCase().includes("trans")) {
      return("tk");
    } else if (grade.toLowerCase().includes("p")) {
      return("pk");
    } else if (grade.toLowerCase().includes("j")) {
      return("jk");
    } else if (grade.substring(0,3).toLowerCase() === "kin") { 
      return("k");
    } else if (grade.toLowerCase() == "adult") {
      return("adult");
    } else if (!isNaN(parseInt(grade))) {
      // this catches strings like 1st, 2nd, 3rd
      let gradeNum = parseInt(grade);
      return(gradeNum.toString());
    } else {
      console.warn(grade, "not recognized as a grade");
      return grade.toString();
    }
  } else {
    // parse as a number
    let gradeNum = parseInt(grade);

    if (gradeNum < 0) {
      return("pk");
    } else if (gradeNum === 0) {
      return("k");
    } else if ((gradeNum >= 1) && (gradeNum <=12)) {
      return(gradeNum.toString());
    } else {
      return("adult");
    }

  }

};

export function thetaToSupportSWR (percentile, grade) {
  let support;

  // we report automaticity instead of support for grades K/1 
  if ((grade == "K") || (grade == "1")) {
    support = (percentile < 50) ? "Limited" : "Average or Above Average";
  } else {
    support = (percentile < 25) ? "Extra Support Needed" : (percentile < 50) ? "Some Support Needed": "Average or Above Average";
  }
  return support;
};

export function woodcockJohnsonLookup (thetaEstimate) {
  // TODO_Adam replace this totally fake calculation with a real lookup table based on thetaEstimate and ageMonths
  console.log("WARNING: fake woodcockJohnsonLookup still in use");
  return Math.round(100 * (thetaEstimate +4)/8);
};

export function percentileToSupportClassification(taskId, percentile, grade=1) {
  let support = "";

  switch(taskId) {
    case "pa":
      if ((grade == "K") || (grade <= "4")) {
        support = (percentile < 25) ? "Extra Support Needed" : (percentile < 50) ? "Some Support Needed": "Average or Above Average";
      } else {
        support = (percentile < 15) ? "Extra Support Needed" : (percentile < 30) ? "Some Support Needed": "Average or Above Average";
      }
      break;

    case "swr":
    // we report automaticity instead of support for grades K/1 
    if ((grade == "K") || (grade == "1")) {
      support = (percentile < 50) ? "Limited" : "Average or Above Average";
    } else {
      support = (percentile < 25) ? "Extra Support Needed" : (percentile < 50) ? "Some Support Needed": "Average or Above Average";
    }
      break;

    case "sre":
    case "vocab":
      console.log("TODO add sre and vocab cases to percentileToSupportClassification() ")
      break;

    default:
      console.log(taskId, "missing from switch statement");
  }

  return(support);
};

export function countItems(dataArray, searchValue) {
  // TODO_Adam -- how do I make the first param be treated as an array?
  // Tonya- the first item can be treated an array as long as you make sure to always
  //        pass an array first- pure javascript has no 'type forcing'. Does the solution
  //        below work for your purposes?

  // let count = dataArray.reduce((n, x) => n + (x === searchValue), 0);
  // return(count);
  return dataArray.filter(x => x === searchValue);
};

export const gradeComparator = (a, b) => {
  const order = ['pk', 'jk', 'tk', 'k', '1', '2', '3','4', '5', '6', '7', 
                 '8', '9', '10', '11', '12', 'adult'];  

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
    if (a > b)
      return 1;
    else
      return -1;
  } else if (indexA > indexB){
    // string a was later in the array
    return 1;
  } else {
    // b was later in the array
    return -1;
  }
}

// 
export const getRunScores = (runBlocks) => {
  //get the run's task ID
  const taskId = [...new Set(runBlocks.map((block) => block.taskId))][0]
  switch(taskId) {
    case "pa":
      const paSubScores = runBlocks.filter((block) => ["FSM", "LSM", "DEL"].includes(block.blockId.toUpperCase()));
      const paScore = { ...paSubScores[0] };
      ["attempted", "correct", "incorrect"].forEach((scoreType) => {
        const total = paSubScores.reduce((a, b) => {
          return a + b[scoreType]
        }, 0 );
        paScore[scoreType] = total;
      })
      return {
        ...paScore,
        blockId: "total",
      };

    case "swr":
      // Assume there is only one subscore for SWR
      return runBlocks[0]

    case "sre":
      // TODO: Confirm SRE blockId names
      const sreSubScores = runBlocks.filter((block) => ["LAB", "TOSREC"].contains(block.blockId.toUpperCase()))
      const sreScore = sreSubScores[0];
      sreScore.blockId = "total";
      ["attempted", "correct", "incorrect"].forEach((scoreType) => {
        sreScore[scoreType] = sreSubScores.reduce((a, b) => a[scoreType] + b[scoreType], 0);
      })
      return sreScore;

    case "vocab":
      console.log("TODO add sre and vocab cases")
      break;

    default:
      console.log(taskId, "missing from switch statement");
  }
}

// Returns list of schools in given dataset
export const getSchools = (dataSet) => {
  let schools = []
  _forEach(dataSet, block => {
    schools = _union(schools, [_get(block, 'school_name')])
  })
  return schools
}

// Returns min, max, mean age for given dataset
export const getAges = (dataSet) => {
  const ages = _map(dataSet, score => computeAges((score.dob ?? score.birthdate), score.timeStarted)).filter(x => {
    // Filter out entries without ages
    return x.ageMonths && x.ageYears
  })
  if (ages.length === 0) {
    return null;
  }
  const ageYears = _map(ages, age => _get(age, 'ageYears'))
  return {
    ageMin: Math.min(...ageYears),
    ageMax: Math.max(...ageYears),
    ageMean: (ageYears.reduce((a, b) => parseInt(a) + parseInt(b)) / ages.length).toFixed(1),
  };
}

// Returns max grade, min grade, and whether kindergarden/first is included
export const getGrades = (dataSet) => {
  const parsedGrades = dataSet.map((score) => parseGrade(score.grade)).filter(x => x !== 'NA');
  const hasFirstOrK = (parsedGrades.includes("k") || 
                        parsedGrades.includes("pk") || 
                        parsedGrades.includes("tk") ||
                        parsedGrades.includes("jk") ||
                        parsedGrades.includes("1"));

  if (parsedGrades.length === 0) {
    return null;
  }
  return {
    gradeMin: parsedGrades.reduce(function(prev, curr) {
      return (gradeComparator(curr, prev) === 1)? prev : curr;
    }),
    gradeMax: parsedGrades.reduce(function(prev, curr) {
      return (gradeComparator(curr, prev) === 1)? curr : prev;
    }),
    hasFirstOrK: hasFirstOrK,
  };
}

// Returns ROAR scores for SWR runs 
export const getRoarScoreStats = (dataSet) => {
  const roarScoresArray = dataSet.map((score) => thetaToRoarScore(score.thetaEstimate));
  return {
    // Note: all calculations must gracefully handle an array length of 0
    roarScoreMin: Math.min(...roarScoresArray),
    roarScoreMax: Math.max(...roarScoresArray),
    roarScoreMean: Math.round(roarScoresArray.reduce((a, b) => a + b,0) / roarScoresArray.length),
    roarScoreStandardDev: standardDeviation(roarScoresArray).toFixed(0),
  };
}

// Returns min, max, mean, and std deviation tosrec scores
export const getSreTosrecScores = (dataSet) => {
  // dataSet is array of all sre runs (can be set of all blocks, if needed)
  // TODO calculation: SRE tosrec scores
  return {}
}

// Returns total correct questions answered in PA and SRE runs
export const getTotalCorrect = (dataSet) => {
  // TODO: Follow up with Jasmine to ensure this field is being calculated correctly
  let total = 0
  _forEach(dataSet, block => {
    total += _get(block, 'correct')
  })
  return total
}

// Returns support stats for SWR runs
export const swrSupportStats = (dataSet) => {
  let stats = {
    // set defaults
    averageSupport: null,
    someSupport: null,
    extraSupport: null,
    limitedAutomaticity: null,
    averageAutomaticity: null
  };
  const supportArray = dataSet.map((run) => _get(run, 'runInfo.supportLevel'));
  if (supportArray.length === 0) {
    return stats;
  } 

  // update values
  stats.averageSupport = supportArray.filter(x => x === "Average or Above Average").length; 
  stats.someSupport = supportArray.filter(x => x === "Some Support Needed").length; 
  stats.extraSupport = supportArray.filter(x => x === "Extra Support Needed").length; 
  stats.averageAutomaticity = supportArray.filter(x => x === "Average or Above Average").length; 
  stats.limitedAutomaticity = supportArray.filter(x => x === "Limited").length; 

  return stats;
}

// Returns support stats for PA runs
export const paSupportStats = (dataSet) => {
  let stats = {
    averageSupport: null,
    someSupport: null,
    extraSupport: null
  }
  const supportArray = dataSet.map((run) => _get(run, 'runInfo.supportLevel'))
  if(supportArray.length === 0){
    return stats
  }

  stats.averageSupport = supportArray.filter(x => x === "Average or Above Average").length;
  stats.someSupport = supportArray.filter(x => x === "Some Support Needed").length; 
  stats.extraSupport = supportArray.filter(x => x === "Extra Support Needed").length; 
  return stats
}

// Returns counts of the different block types in PA.
export const paSkillCounts = (dataSet) => {
  let stats = {
    LSM: null,
    FSM: null,
    DEL: null
  }
  const skillArray = dataSet.map((block) => block.blockId)
  if(skillArray.length === 0) return stats;

  stats.LSM = skillArray.filter(x => x === 'LSM').length
  stats.FSM = skillArray.filter(x => x === 'FSM').length
  stats.DEL = skillArray.filter(x => x === 'DEL').length
  return stats
}

// Returns support stats for SRE runs
export const sreSupportStats = (dataSet) => {
  // dataSet is an array of all sre runs
  // TODO calculation: SRE Support stats
  return {}
}

// Returns support stats for Vocab Runs
export const vocabSupportStats = (dataSet) => {
  // dataSet is an array of all vocab runs
  // TODO calculation: Vocab Support stats
  return {}
}