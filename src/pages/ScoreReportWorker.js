import {
  taskInfoById,
  supportLevelColors,
  rawOnlyTasks,
  tasksToDisplayPercentCorrect,
  getScoreKeys,
  tasksToDisplayCorrectIncorrectDifference,
  getGrade,
  getSupportLevel,
} from '@/helpers/reports.js';
import _get from 'lodash/get';
import _toUpper from 'lodash/toUpper';
import _pickBy from 'lodash/pickBy';
import _round from 'lodash/round';

self.onmessage = function (message) {
  // Fetch coins data from the API and send the result back to the main thread
  processAssignmentData(message.data);
};

function getScoreKeysByRow(row, grade) {
  const taskId = row?.taskId;
  return getScoreKeys(taskId, grade);
}

// Return a faded color if assessment is not reliable
function returnColorByReliability(assessment, rawScore, support_level, tag_color) {
  if (assessment.reliable !== undefined && !assessment.reliable && assessment.engagementFlags !== undefined) {
    if (support_level === 'Optional') {
      return '#a1d8e3';
    } else if (support_level === 'Needs Extra Support') {
      return '#d6b8c7';
    } else if (support_level === 'Developing Skill') {
      return '#e8dbb5';
    } else if (support_level === 'Achieved Skill') {
      return '#c0d9bd';
    } else if (rawOnlyTasks.includes(assessment.taskId) && rawScore) {
      return 'white';
    } else {
      return '#d3d3d3';
    }
  }
  return tag_color;
}

const getScoresAndSupportFromAssessment = ({
  grade,
  assessment,
  standardScoreDisplayKey,
  percentileScoreKey,
  percentileScoreDisplayKey,
  rawScoreKey,
  taskId,
  optional,
}) => {
  let percentile = _get(assessment, `scores.computed.composite.${percentileScoreKey}`);
  let percentileString = _get(assessment, `scores.computed.composite.${percentileScoreDisplayKey}`);
  let standardScore = _get(assessment, `scores.computed.composite.${standardScoreDisplayKey}`);
  let rawScore = _get(assessment, `scores.computed.composite.${rawScoreKey}`);

  const { support_level, tag_color } = getSupportLevel(grade, percentile, rawScore, taskId, optional);
  if (percentile) percentile = _round(percentile);
  if (percentileString && !isNaN(_round(percentileString))) percentileString = _round(percentileString);

  return {
    support_level,
    tag_color,
    percentile,
    percentileString,
    standardScore,
    rawScore,
  };
};

// This function takes in the return from assignmentFetchAll and returns 2 objects
// 1. assignmentTableData: The data that should be passed into the ROARDataTable component
// 2. runsByTaskId: run data for the TaskReport distribution chartsb
function processAssignmentData(computeData) {
  const parsedComputeData = JSON.parse(computeData);
  const { schoolNameDictionary, schoolsDictWithGrade, assignmentData, adminInfo } = parsedComputeData;
  if (!assignmentData || assignmentData.length === 0) {
    return { assignmentTableData: [], runsByTaskId: {} };
  }

  // assignmentTableData is an array of objects, each representing a row in the table
  const assignmentTableDataAcc = [];
  // runsByTaskId is an object with keys as taskIds and values as arrays of scores
  const runsByTaskIdAcc = {};

  for (const { assignment, user } of assignmentData) {
    // for each row, compute: username, firstName, lastName, assessmentPID, grade, school, all the scores, and routeParams for report link
    const grade = user.studentData?.grade;
    // compute schoolName
    let schoolName = '';
    const schoolId = user?.schools?.current[0];
    if (schoolId) {
      schoolName = schoolNameDictionary[schoolId];
    }

    const firstNameOrUsername = user.name.first ?? user.username;

    const currRow = {
      user: {
        username: user.username,
        email: user.email,
        userId: user.userId,
        firstName: user.name.first,
        lastName: user.name.last,
        grade: grade,
        assessmentPid: user.assessmentPid,
        schoolName: schoolName,
      },
      tooltip: `View ${firstNameOrUsername}'s Score Report`,
      routeParams: {
        administrationId: adminInfo.administrationId,
        orgId: adminInfo.orgId,
        orgType: adminInfo.orgType,
        userId: user.userId,
      },
      // compute and add scores data in next step as so
      // swr: { support_level: 'Needs Extra Support', percentile: 10, raw: 10, reliable: true, engagementFlags: {}},
    };

    let numAssignmentsCompleted = 0;
    const currRowScores = {};
    for (const assessment of assignment.assessments) {
      // General Logic to grab support level, scores, etc
      let scoreFilterTags = '';
      const taskId = assessment.taskId;
      const isOptional = assessment.optional;
      if (isOptional) {
        scoreFilterTags += ' Optional ';
      } else {
        scoreFilterTags += ' Required ';
      }
      if (assessment.reliable == true) {
        scoreFilterTags += ' Reliable ';
      } else {
        scoreFilterTags += ' Unreliable ';
      }
      // Add filter tags for completed/incomplete
      if (assessment.completedOn != undefined) {
        numAssignmentsCompleted += 1;
        scoreFilterTags += ' Completed ';
      } else if (assessment.startedOn != undefined) {
        scoreFilterTags += ' Started ';
      } else {
        scoreFilterTags += ' Assigned ';
      }
      // Add filter tags for assessed (what is this?)
      if (typeof assessment?.scores?.computed?.composite == 'number') {
        scoreFilterTags += ' Assessed ';
      }

      const { percentileScoreKey, rawScoreKey, percentileScoreDisplayKey, standardScoreDisplayKey } = getScoreKeysByRow(
        assessment,
        getGrade(_get(user, 'studentData.grade')),
      );
      // compute and add scores data in next step as so
      const { support_level, tag_color, percentile, percentileString, standardScore, rawScore } =
        getScoresAndSupportFromAssessment({
          grade: grade,
          assessment,
          percentileScoreKey,
          percentileScoreDisplayKey,
          standardScoreDisplayKey,
          rawScoreKey,
          taskId,
          isOptional,
        });

      if (tag_color === supportLevelColors.above) {
        scoreFilterTags += ' Green ';
      } else if (tag_color === supportLevelColors.some) {
        scoreFilterTags += ' Yellow ';
      } else if (tag_color === supportLevelColors.below) {
        scoreFilterTags += ' Pink ';
      }

      const tagColor = returnColorByReliability(assessment, rawScore, support_level, tag_color);

      // Logic to update assignmentTableDataAcc
      currRowScores[taskId] = {
        optional: isOptional,
        supportLevel: support_level,
        reliable: assessment.reliable,
        engagementFlags: assessment.engagementFlags ?? [],
        tagColor: tagColor,
        percentile: percentile,
        percentileString: percentileString,
        rawScore: rawScore,
        standardScore: standardScore,
        tags: scoreFilterTags,
      };

      if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        const numCorrect = assessment.scores?.raw?.composite?.test?.numCorrect;
        const numIncorrect = assessment.scores?.raw?.composite?.test?.numAttempted - numCorrect;
        currRowScores[taskId].correctIncorrectDifference =
          numCorrect != null && numIncorrect != null ? numCorrect - numIncorrect : null;
        currRowScores[taskId].numCorrect = numCorrect;
        currRowScores[taskId].numIncorrect = numIncorrect;
        currRowScores[taskId].tagColor = supportLevelColors.Assessed;
        scoreFilterTags += ' Assessed ';
      } else if (tasksToDisplayPercentCorrect.includes(taskId)) {
        const numAttempted = assessment.scores?.raw?.composite?.test?.numAttempted;
        const numCorrect = assessment.scores?.raw?.composite?.test?.numCorrect;
        const percentCorrect = numAttempted > 0 ? Math.round((numCorrect * 100) / numAttempted).toString() + '%' : null;
        currRowScores[taskId].percentCorrect = percentCorrect;
        currRowScores[taskId].numAttempted = numAttempted;
        currRowScores[taskId].numCorrect = numCorrect;
        scoreFilterTags += ' Assessed ';
      }

      if (taskId === 'letter' && assessment.scores) {
        currRowScores[taskId].lowerCaseScore = assessment.scores.computed.LowercaseNames?.subScore;
        currRowScores[taskId].upperCaseScore = assessment.scores.computed.UppercaseNames?.subScore;
        currRowScores[taskId].phonemeScore = assessment.scores.computed.Phonemes?.subScore;
        currRowScores[taskId].totalScore = assessment.scores.computed.composite?.totalCorrect;
        const incorrectLettersArray = [
          ...(_get(assessment, 'scores.computed.UppercaseNames.upperIncorrect') ?? '').split(','),
          ...(_get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect') ?? '').split(','),
        ]
          .sort((a, b) => _toUpper(a) - _toUpper(b))
          .filter(Boolean)
          .join(', ');
        currRowScores[taskId].incorrectLetters = incorrectLettersArray.length > 0 ? incorrectLettersArray : 'None';

        const incorrectPhonemesArray = (_get(assessment, 'scores.computed.Phonemes.phonemeIncorrect') ?? '')
          .split(',')
          .join(', ');
        currRowScores[taskId].incorrectPhonemes = incorrectPhonemesArray.length > 0 ? incorrectPhonemesArray : 'None';
      }
      if (taskId === 'pa' && assessment.scores) {
        const first = _get(assessment, 'scores.computed.FSM.roarScore');
        const last = _get(assessment, 'scores.computed.LSM.roarScore');
        const deletion = _get(assessment, 'scores.computed.DEL.roarScore');
        let skills = [];
        if (first < 15) skills.push('First Sound Matching');
        if (last < 15) skills.push('Last sound matching');
        if (deletion < 15) skills.push('Deletion');
        currRowScores[taskId].firstSound = first;
        currRowScores[taskId].lastSound = last;
        currRowScores[taskId].deletion = deletion;
        currRowScores[taskId].total = _get(assessment, 'scores.computed.composite.roarScore');
        currRowScores[taskId].skills = skills.length > 0 ? skills.join(', ') : 'None';
      }

      // Logic to update runsByTaskIdAcc
      const run = {
        // A bit of a workaround to properly sort grades in facetted graphs (changes Kindergarten to grade 0)
        grade: getGrade(grade),
        scores: {
          support_level: support_level,
          stdPercentile: percentile,
          rawScore: rawScore,
        },
        taskId,
        user: {
          grade: grade,
          schoolName: schoolsDictWithGrade[schoolId],
        },
        tag_color: tag_color,
      };

      if (run.taskId in runsByTaskIdAcc) {
        runsByTaskIdAcc[run.taskId].push(run);
      } else {
        runsByTaskIdAcc[run.taskId] = [run];
      }
    }

    // update scores for current row with computed object
    currRow.scores = currRowScores;
    currRow.numAssignmentsCompleted = numAssignmentsCompleted;
    // push currRow to assignmentTableDataAcc
    assignmentTableDataAcc.push(currRow);
  }

  // sort by numAssignmentsCompleted
  assignmentTableDataAcc.sort((a, b) => b.numAssignmentsCompleted - a.numAssignmentsCompleted);

  const filteredRunsByTaskId = _pickBy(runsByTaskIdAcc, (scores, taskId) => {
    return Object.keys(taskInfoById).includes(taskId);
  });

  self.postMessage({ assignmentTableData: assignmentTableDataAcc, runsByTaskId: filteredRunsByTaskId });
  return;
}
