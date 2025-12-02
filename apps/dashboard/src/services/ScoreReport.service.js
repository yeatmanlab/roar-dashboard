import _lowerCase from 'lodash/lowerCase';
import _toUpper from 'lodash/toUpper';
import {
  getDialColor,
  rawOnlyTasks,
  taskDisplayNames,
  getExtendedDescription as _getExtendedDescription,
  getSupportLevel,
  getRawScoreRange,
  getScoreValue,
  tasksToDisplayPercentCorrect,
} from '@/helpers/reports';
import { SCORE_SUPPORT_SKILL_LEVELS, SCORE_TYPES } from '@/constants/scores';
import { TAG_SEVERITIES } from '@/constants/tags';

/**
 * ScoreReport Service
 */
const ScoreReportService = (() => {
  // --- NEW: tiny translator fallback only for suffixes ---
  const tFallbackMap = {
    'scoreReports.st': 'st',
    'scoreReports.nd': 'nd',
    'scoreReports.rd': 'rd',
    'scoreReports.th': 'th',
  };
  const tt = (i18n, key) => (i18n && typeof i18n.t === 'function' ? i18n.t(key) : (tFallbackMap[key] ?? key));

  // --- NEW: safe wrapper for getExtendedDescription to avoid test-time import/mocking issues ---
  const safeGetExtendedDescription = (taskId) => {
    try {
      return typeof _getExtendedDescription === 'function' ? _getExtendedDescription(taskId) : '';
    } catch {
      return '';
    }
  };

  /**
   * Get the appropriate suffix for a percentile number (st, nd, rd, th)
   */
  const getPercentileSuffix = (percentile, i18n) => {
    const lastDigit = percentile % 10;
    const lastTwoDigits = percentile % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return tt(i18n, 'scoreReports.th');

    switch (lastDigit) {
      case 1:
        return tt(i18n, 'scoreReports.st');
      case 2:
        return tt(i18n, 'scoreReports.nd');
      case 3:
        return tt(i18n, 'scoreReports.rd');
      default:
        return tt(i18n, 'scoreReports.th');
    }
  };

  const getPercentileWithSuffix = (percentile, i18n) => {
    return `${percentile}${getPercentileSuffix(percentile, i18n)}`;
  };

  const getSupportLevelLanguage = (grade, percentile, rawScore, taskId, i18n, scoringVersion) => {
    const { support_level: supportLevel } = getSupportLevel(grade, percentile, rawScore, taskId, null, scoringVersion);

    switch (supportLevel) {
      case SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL:
        return i18n.t('scoreReports.achievedText');
      case SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL:
        return i18n.t('scoreReports.developingText');
      case SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT:
        return i18n.t('scoreReports.extraSupportText');
      default:
        return '';
    }
  };

  const createTaskTags = (optional, reliable, engagementFlags, i18n) => {
    const tags = [];

    tags.push({
      icon: 'pi pi-info-circle',
      label: 'Type',
      value: i18n.t(optional ? 'scoreReports.optional' : 'scoreReports.required'),
      severity: TAG_SEVERITIES.INFO,
      tooltip: i18n.t(optional ? 'scoreReports.optionalTagText' : 'scoreReports.requiredTagText'),
    });

    tags.push({
      value: i18n.t(reliable === false ? 'scoreReports.unreliable' : 'scoreReports.reliable'),
      label: 'Reliability',
      icon: reliable === false ? 'pi pi-times' : 'pi pi-check',
      severity: reliable === false ? TAG_SEVERITIES.DANGER : TAG_SEVERITIES.SUCCESS,
      tooltip:
        reliable === false
          ? engagementFlags
            ? `${i18n.t('scoreReports.unreliableTagTextFlags')}: \n\n${Object.keys(engagementFlags)
                .map((flag) => _lowerCase(flag))
                .join(', ')}`
            : i18n.t('scoreReports.unreliableTagText')
          : i18n.t('scoreReports.reliableTagText'),
    });

    return tags;
  };

  const createScoresArray = (taskId, scoresForTask, scores, grade, i18n) => {
    let formattedScoresArray = [];
    // Display percent correct (mapped as percentileScore in processTaskScores) in accordion
    if (tasksToDisplayPercentCorrect.includes(taskId)) {
      const { name, value, min, max } = scoresForTask['percentileScore'];
      formattedScoresArray = [[name, value, min, max]];
    } else {
      formattedScoresArray = Object.keys(scoresForTask).map((key) => {
        const score = scoresForTask[key];
        return [score.name, score.value, score.min, score.max];
      });
    }

    if (taskId === 'pa') {
      const fsm = scores?.FSM?.roarScore;
      const lsm = scores?.LSM?.roarScore;
      const del = scores?.DEL?.roarScore;
      const skills = [];

      if (fsm < 15) skills.push('FSM');
      if (lsm < 15) skills.push('LSM');
      if (del < 15) skills.push('DEL');

      formattedScoresArray.push([i18n.t('scoreReports.firstSoundMatching'), fsm]);
      formattedScoresArray.push([i18n.t('scoreReports.lastSoundMatching'), lsm]);
      formattedScoresArray.push([i18n.t('scoreReports.deletion'), del]);
      formattedScoresArray.push([i18n.t('scoreReports.skillsToWorkOn'), skills.join(', ') || 'None']);
    }

    if (taskId === 'letter' || taskId === 'letter-en-ca') {
      const upperIncorrect = scores?.UppercaseNames?.upperIncorrect;
      const lowerIncorrect = scores?.LowercaseNames?.lowerIncorrect;
      const incorrectLetters = [
        Array.isArray(upperIncorrect) ? upperIncorrect : [],
        Array.isArray(lowerIncorrect) ? lowerIncorrect : [],
      ]
        .flat()
        .sort((a, b) => _toUpper(a).localeCompare(_toUpper(b)))
        .filter(Boolean)
        .join(', ');

      const phonemeIncorrect = scores?.Phonemes?.phonemeIncorrect;
      const incorrectPhonemes = Array.isArray(phonemeIncorrect) ? phonemeIncorrect.join(', ') : '';

      formattedScoresArray.push([i18n.t('Lower Case'), scores?.LowercaseNames?.subScore, 0, 26]);
      formattedScoresArray.push([i18n.t('Upper Case'), scores?.UppercaseNames?.subScore, 0, 26]);
      formattedScoresArray.push([i18n.t('Letter Sounds'), scores?.Phonemes?.subScore, 0, 38]);
      formattedScoresArray.push([i18n.t('Letter To Work On'), incorrectLetters]);
      formattedScoresArray.push([i18n.t('Letter Sounds To Work On'), incorrectPhonemes]);
    }

    const order = { 'Raw Score': 2, 'Percentile Score': 1, 'Standard Score': 0 };

    if (grade >= 6) {
      formattedScoresArray = formattedScoresArray.filter(([key]) => key !== 'Percentile Score');
    }

    return formattedScoresArray.sort((a, b) => (order[a[0]] ?? 99) - (order[b[0]] ?? 99));
  };

  const getPercentileSuffixTemplate = (percentile, i18n) => {
    return `{value}${getPercentileSuffix(percentile, i18n)}`;
  };

  const getScoreDescription = (task, grade, i18n, scoringVersion) => {
    const taskName = taskDisplayNames[task.taskId]?.extendedName;

    // --- CHANGED: use safe wrapper instead of direct call ---
    const taskDescription = safeGetExtendedDescription(String(task.taskId));

    if (tasksToDisplayPercentCorrect.includes(task.taskId)) {
      return {
        keypath: 'scoreReports.percentageCorrectTaskDescription',
        slots: {
          percentage: Math.round(task.percentileScore.value),
          supportCategory: getSupportLevelLanguage(
            grade,
            task?.percentileScore.value,
            task?.rawScore.value,
            task.taskId,
            i18n,
            scoringVersion,
          ),
          taskName,
          taskDescription,
        },
      };
    }

    if (rawOnlyTasks.includes(task.taskId)) {
      return {
        keypath: 'scoreReports.rawTaskDescription',
        slots: {
          rawScore: task.rawScore.value,
          taskName,
          taskDescription,
        },
      };
    }

    if (grade >= 6) {
      return {
        keypath: 'scoreReports.standardTaskDescription',
        slots: {
          standardScore: Math.round(task.standardScore.value),
          supportCategory: getSupportLevelLanguage(
            grade,
            task?.percentileScore.value,
            task?.rawScore.value,
            task.taskId,
            i18n,
            scoringVersion,
          ),
          taskName,
          taskDescription,
        },
      };
    }

    return {
      keypath: 'scoreReports.percentileTaskDescription',
      slots: {
        percentile:
          getPercentileWithSuffix(Math.round(task?.percentileScore.value), i18n) +
          ` ${i18n.t('scoreReports.percentileScore')}`,
        supportCategory: getSupportLevelLanguage(
          grade,
          task.percentileScore.value,
          task.rawScore.value,
          task.taskId,
          i18n,
          scoringVersion,
        ),
        taskName,
        taskDescription,
      },
    };
  };

  const getScoresArrayForTask = (task) => {
    if (!rawOnlyTasks.includes(task.taskId) || task.taskId === 'letter' || task.taskId === 'letter-en-ca') {
      return task.scoresArray;
    }
    return null;
  };

  const getScoreToDisplay = (taskId, grade, rawOnlyTasks) => {
    const alwaysDisplaysPercentile = ['phonics', 'letter', 'letter-es', 'letter-en-ca'];

    if (rawOnlyTasks.includes(taskId)) {
      return SCORE_TYPES.RAW_SCORE;
    }

    if (alwaysDisplaysPercentile.includes(taskId)) {
      return SCORE_TYPES.PERCENTILE_SCORE;
    }

    return grade >= 6 ? SCORE_TYPES.STANDARD_SCORE : SCORE_TYPES.PERCENTILE_SCORE;
  };

  const processTaskScores = (taskData, grade, i18n, scoringVersions = {}) => {
    const tasksBlacklist = ['vocab'];
    const computedTaskAcc = {};

    for (const { taskId, scores, reliable, optional, engagementFlags } of taskData) {
      const compositeScores = scores?.composite;

      let rawScore = null;

      const useSpanishNorms = (taskId === 'swr-es' || taskId === 'sre-es') && scoringVersions[taskId] >= 1;
      if (!taskId.includes('vocab') && (!taskId.includes('es') || useSpanishNorms)) {
        rawScore = getScoreValue(compositeScores, taskId, grade, 'rawScore');
      } else {
        rawScore = compositeScores;
      }

      // SCORE_FIELD_MAPPINGS.rawScore enables, SCORE_FIELD_MAPPINGS.percentileScore determines dial value
      if (!isNaN(rawScore) && !tasksBlacklist.includes(taskId)) {
        const percentileScore = getScoreValue(compositeScores, taskId, grade, 'percentile');
        const standardScore = getScoreValue(compositeScores, taskId, grade, SCORE_TYPES.STANDARD_SCORE);
        const rawScoreRange = getRawScoreRange(taskId);
        const supportColor = getDialColor(grade, percentileScore, rawScore, taskId, optional, scoringVersions[taskId]);

        const scoresForTask = {
          standardScore: {
            name: i18n.t('scoreReports.standardScore'),
            value: Math.round(standardScore),
            min: 0,
            max: 180,
            supportColor,
          },
          rawScore: {
            name: i18n.t('scoreReports.rawScore'),
            value: Math.round(rawScore),
            min: rawScoreRange?.min,
            max: rawScoreRange?.max,
            supportColor,
          },
          percentileScore: {
            name: tasksToDisplayPercentCorrect.includes(taskId)
              ? i18n.t('scoreReports.percentCorrect')
              : i18n.t('scoreReports.percentileScore'),
            value: Math.round(percentileScore),
            min: 0,
            max: taskId.includes('letter') ? 100 : 99,
            supportColor,
          },
        };

        const tags = createTaskTags(optional, reliable, engagementFlags, i18n);
        const scoreToDisplay = getScoreToDisplay(taskId, grade, rawOnlyTasks);

        computedTaskAcc[taskId] = {
          taskId,
          scoreToDisplay,
          ...scoresForTask,
          tags,
          scores,
        };

        computedTaskAcc[taskId].scoresArray = createScoresArray(taskId, scoresForTask, scores, grade, i18n);
      }
    }

    return Object.keys(computedTaskAcc)
      .sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order)
      .map((taskId) => computedTaskAcc[taskId]);
  };

  return {
    getPercentileSuffixTemplate,
    getScoreDescription,
    getScoresArrayForTask,
    processTaskScores,
  };
})();

export default ScoreReportService;
