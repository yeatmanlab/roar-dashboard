import _kebabCase from 'lodash/kebabCase';
import { exportCsv } from '../helpers/query/utils';
import {
  rawOnlyTasks,
  tasksToDisplayCorrectIncorrectDifference,
  tasksToDisplayPercentCorrect,
  tasksToDisplayTotalCorrect,
  tasksToDisplayGraphs,
} from '@/helpers/reports.js';
import _get from 'lodash/get';
import _toUpper from 'lodash/toUpper';
import { getTitle } from '@/helpers/query/administrations';

export const exportReportCombination = async (
  assignmentData,
  tasksDictionary,
  authStore,
  props,
  orgInfo,
  administrationInfo,
  isSuperAdmin,
) => {
  // if (!assignmentData || !assignmentData.value || !Array.isArray(assignmentData.value)) {
  //     console.error('Invalid assignmentData provided:', assignmentData);
  //     return;
  //   }

  console.log(
    'rawOnlyTasks:',
    rawOnlyTasks,
    'tasksToDisplayCorrectIncorrectDifference:',
    tasksToDisplayCorrectIncorrectDifference,
    'tasksToDisplayPercentCorrect',
    tasksToDisplayPercentCorrect,
    'tasksToDisplayTotalCorrect:',
    tasksToDisplayTotalCorrect,
    'tasksToDisplayGraphs:',
    tasksToDisplayGraphs,
  );
  const computedExportData = assignmentData?.map((item) => {
    const user = item.user;
    const progress = item.assignment?.assessments || [];

    let tableRow = {
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    };

    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }

    if (props.orgType === 'district') {
      tableRow['School'] = _get(user, 'schools.current[0].name');
    }

    for (const assessment of progress) {
      const taskId = assessment.taskId;
      const scores = assessment.scores || {};

      // Handle task-specific logic
      if (tasksToDisplayCorrectIncorrectDifference.includes(taskId)) {
        const numCorrect = scores?.raw?.composite?.test?.numCorrect;
        const numIncorrect = scores?.raw?.composite?.test?.numAttempted - numCorrect;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Correct/Incorrect Difference`] =
          numCorrect != null && numIncorrect != null ? Math.round(numCorrect - numIncorrect) : null;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Correct`] = numCorrect;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Incorrect`] = numIncorrect;
      } else if (tasksToDisplayPercentCorrect.includes(taskId)) {
        const numAttempted = scores?.raw?.composite?.test?.numAttempted;
        const numCorrect = scores?.raw?.composite?.test?.numCorrect;
        const percentCorrect =
          numAttempted > 0 && !isNaN(numCorrect) && !isNaN(numAttempted)
            ? Math.round((numCorrect * 100) / numAttempted).toString() + '%'
            : null;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Percent Correct`] = percentCorrect;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Attempted`] = numAttempted;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Correct`] = numCorrect;
      } else if (tasksToDisplayTotalCorrect.includes(taskId)) {
        const numAttempted = scores?.raw?.composite?.test?.numAttempted;
        const numCorrect =
          numAttempted === undefined || numAttempted === 0
            ? ''
            : numAttempted !== 0 && scores?.raw?.composite?.test?.numCorrect !== undefined
            ? scores?.raw?.composite?.test?.numCorrect
            : 0;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Attempted`] = numAttempted;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Num Correct`] = numCorrect;
      } else if (rawOnlyTasks.includes(taskId)) {
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Raw`] = scores.rawScore;
      } else if (tasksToDisplayGraphs.includes(taskId)) {
        console.log('taskDictionary:', tasksDictionary);
        // tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Percentile`] = scores.percentileString;
        // tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Standard`] = scores.standardScore;
        // tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Raw`] = scores.rawScore;
        // tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Support Level`] = scores.supportLevel;
      }

      // Handle special cases for specific taskIds
      if (taskId === 'letter' && scores) {
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Lower Case Score`] =
          scores.computed?.LowercaseNames?.subScore;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Upper Case Score`] =
          scores.computed?.UppercaseNames?.subScore;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Phoneme Score`] =
          scores.computed?.Phonemes?.subScore;
        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Total Score`] =
          scores.computed?.composite?.totalCorrect;

        const incorrectLettersArray = [
          ...(_get(assessment, 'scores.computed.UppercaseNames.upperIncorrect') ?? '').split(','),
          ...(_get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect') ?? '').split(','),
        ]
          .sort((a, b) => _toUpper(a) - _toUpper(b))
          .filter(Boolean)
          .join(', ');

        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Incorrect Letters`] =
          incorrectLettersArray.length > 0 ? incorrectLettersArray : 'None';

        const incorrectPhonemesArray = (_get(assessment, 'scores.computed.Phonemes.phonemeIncorrect') ?? '')
          .split(',')
          .join(', ');

        tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Incorrect Phonemes`] =
          incorrectPhonemesArray.length > 0 ? incorrectPhonemesArray : 'None';
      }

      //   if (taskId === 'pa' && scores) {
      //     const first = _get(scores, 'computed.FSM.roarScore');
      //     const last = _get(scores, 'computed.LSM.roarScore');
      //     const deletion = _get(scores, 'computed.DEL.roarScore');
      //     let skills = [];
      //     if (first < 15) skills.push('First Sound Matching');
      //     if (last < 15) skills.push('Last sound matching');
      //     if (deletion < 15) skills.push('Deletion');
      //     tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - First Sound`] = first;
      //     tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Last Sound`] = last;
      //     tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Deletion`] = deletion;
      //     tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Total`] = _get(
      //       scores,
      //       'computed.composite.roarScore',
      //     );
      //     tableRow[`${tasksDictionary.value[taskId]?.publicName ?? taskId} - Skills`] =
      //       skills.length > 0 ? skills.join(', ') : 'None';
      //   }
    }

    return tableRow;
  });

  exportCsv(
    computedExportData,
    `roar-progress-${_kebabCase(getTitle(administrationInfo.value, isSuperAdmin.value))}-${_kebabCase(
      orgInfo.value.name,
    )}.csv`,
  );
};
