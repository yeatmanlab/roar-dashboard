import _lowerCase from 'lodash/lowerCase';
import _startCase from 'lodash/startCase';
import _toUpper from 'lodash/toUpper';
import {
  rawOnlyTasks,
  taskDisplayNames,
  extendedDescriptions,
  getSupportLevel,
  getRawScoreRange,
  getScoreValue,
} from '@/helpers/reports';
import { SCORE_SUPPORT_SKILL_LEVELS, SCORE_TYPES } from '@/constants/scores';
import { TAG_SEVERITIES } from '@/constants/tags';

/**
 * ScoreReport Service
 *
 * Service for handling business logic related to score reports, such as processing task scores and generating score
 * descriptions.
 */
const ScoreReportService = (() => {
  /**
   * Get the appropriate suffix for a percentile number (st, nd, rd, th)
   *
   * @param {number} percentile - The percentile to get suffix for
   * @returns {string} The suffix (st, nd, rd, or th)
   * @private
   */
  const getPercentileSuffix = (percentile) => {
    const lastDigit = percentile % 10;
    const lastTwoDigits = percentile % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }

    switch (lastDigit) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  /**
   * Get percentile with appropriate suffix (1st, 2nd, 3rd, 4th, etc.)
   *
   * @param {number} percentile - The percentile to format
   * @returns {string} The percentile with appropriate suffix
   * @private
   */
  const getPercentileWithSuffix = (percentile) => {
    return `${percentile}${getPercentileSuffix(percentile)}`;
  };

  /**
   * Get support level language key for i18n translation
   *
   * @param {number} grade - The grade level
   * @param {number} percentile - The percentile score
   * @param {number} rawScore - The raw score
   * @param {string} taskId - The task ID
   * @param {Object} i18n - The i18n instance
   * @returns {string} The support level language key
   *
   * @private
   */
  const getSupportLevelLanguage = (grade, percentile, rawScore, taskId, i18n) => {
    const { support_level } = getSupportLevel(grade, percentile, rawScore, taskId);
    return support_level === SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL
      ? i18n.t('scoreReports.achievedText')
      : support_level === SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL
        ? i18n.t('scoreReports.developingText')
        : support_level === SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT
          ? i18n.t('scoreReports.extraSupportText')
          : '';
  };

  /**
   * Create task tags for optional/required and reliable/unreliable status
   *
   * @param {boolean} optional - Whether the task is optional
   * @param {boolean} reliable - Whether the task is reliable
   * @param {Object} engagementFlags - Engagement flags for the task
   * @param {Object} i18n - The i18n instance
   *
   * @returns {Array} The task tags
   *
   * @private
   */
  const createTaskTags = (optional, reliable, engagementFlags, i18n) => {
    const tags = [];

    tags.push({
      icon: 'pi pi-info-circle',
      value: i18n.t(optional ? 'scoreReports.optional' : 'scoreReports.required'),
      severity: TAG_SEVERITIES.INFO,
      tooltip: i18n.t(optional ? 'scoreReports.optionalTagText' : 'scoreReports.requiredTagText'),
    });

    tags.push({
      value: i18n.t(reliable === false ? 'scoreReports.unreliable' : 'scoreReports.reliable'),
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

  /**
   * Create scores array for a task
   *
   * @param {string} taskId - The task ID
   * @param {Object} scoresForTask - The scores for the task
   * @param {Object} scores - The scores object
   * @param {number} grade - The grade level
   * @param {Object} i18n - The i18n instance
   *
   * @returns {Array} The scores array
   *
   * @private
   */
  const createScoresArray = (taskId, scoresForTask, scores, grade, i18n) => {
    let formattedScoresArray = Object.keys(scoresForTask).map((key) => {
      const score = scoresForTask[key];
      return [score.name, score.value, score.min, score.max];
    });

    // Special handling for PA task
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

    // Special handling for letter tasks
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

  /**
   * Get percentile suffix template for i18n interpolation
   *
   * @param {number} percentile - The percentile to format
   * @returns {string} The percentile suffix template
   *
   * @public
   */
  const getPercentileSuffixTemplate = (percentile) => {
    return `{value}${getPercentileSuffix(percentile)}`;
  };

  /**
   * Get score description object for a task
   *
   * @param {Object} task - The task object
   * @param {number} grade - The grade level
   * @param {Object} i18n - The i18n instance
   *
   * @returns {Object} The score description object
   *
   * @public
   */
  const getScoreDescription = (task, grade, i18n) => {
    const taskName = taskDisplayNames[task.taskId]?.extendedName;
    const taskDescription = extendedDescriptions[task.taskId];

    if (rawOnlyTasks.includes(task.taskId)) {
      return {
        keypath: 'scoreReports.rawTaskDescription',
        slots: {
          rawScore: task.rawScore.value,
          taskName,
          taskDescription,
        },
      };
    } else if (grade >= 6) {
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
          ),
          taskName,
          taskDescription,
        },
      };
    } else {
      return {
        keypath: 'scoreReports.percentileTaskDescription',
        slots: {
          percentile: getPercentileWithSuffix(Math.round(task?.percentileScore.value)) + ' percentile',
          supportCategory: getSupportLevelLanguage(
            grade,
            task.percentileScore.value,
            task.rawScore.value,
            task.taskId,
            i18n,
          ),
          taskName,
          taskDescription,
        },
      };
    }
  };

  /**
   * Get scores array for a task
   *
   * @TODO: Replace hard-coded task IDs with constants
   * @TODO: This was ported from the existing helpers but we should confirm expected business logic.
   *
   * @param {Object} task - Task data
   * @returns {Array|null} Array of scores or null
   */
  const getScoresArrayForTask = (task) => {
    if (!rawOnlyTasks.includes(task.taskId) || task.taskId === 'letter' || task.taskId === 'letter-en-ca') {
      return task.scoresArray;
    }
    return null;
  };

  /**
   * Process task data into formatted task scores
   *
   * @TODO: Replace hard-coded task IDs with constants
   *
   * @param {Array} taskData - Array of task data objects
   * @param {number} grade - Student grade
   * @param {Object} i18n - i18n instance for translations
   * @returns {Array} Processed task scores
   */
  const processTaskScores = (taskData, grade, i18n) => {
    const tasksBlacklist = ['vocab', 'cva'];
    const computedTaskAcc = {};

    for (const { taskId, scores, reliable, optional, engagementFlags } of taskData) {
      const compositeScores = scores?.composite;

      let rawScore = null;

      if (!taskId.includes('vocab') && !taskId.includes('es')) {
        rawScore = getScoreValue(compositeScores, taskId, grade, 'rawScore');
      } else {
        rawScore = compositeScores;
      }

      if (!isNaN(rawScore) && !tasksBlacklist.includes(taskId)) {
        const percentileScore = getScoreValue(compositeScores, taskId, grade, 'percentile');
        const standardScore = getScoreValue(compositeScores, taskId, grade, 'standardScore');
        const rawScoreRange = getRawScoreRange(taskId);
        const supportColor = getSupportLevel(grade, percentileScore, rawScore, taskId).tag_color;

        const scoresForTask = {
          standardScore: {
            name: _startCase(i18n.t('scoreReports.standardScore')),
            value: Math.round(standardScore),
            min: 0,
            max: 180,
            supportColor,
          },
          rawScore: {
            name: _startCase(i18n.t('scoreReports.rawScore')),
            value: Math.round(rawScore),
            min: rawScoreRange?.min,
            max: rawScoreRange?.max,
            supportColor: 'gray',
          },
          percentileScore: {
            name: _startCase(i18n.t('scoreReports.percentileScore')),
            value: Math.round(percentileScore),
            min: 0,
            max: 99,
            supportColor,
          },
        };

        const tags = createTaskTags(optional, reliable, engagementFlags, i18n);
        let scoreToDisplay = grade >= 6 ? SCORE_TYPES.STANDARD_SCORE : SCORE_TYPES.PERCENTILE_SCORE;
        if (rawOnlyTasks.includes(taskId)) scoreToDisplay = SCORE_TYPES.RAW_SCORE;

        computedTaskAcc[taskId] = {
          taskId,
          scoreToDisplay,
          ...scoresForTask,
          tags,
          scores, // Include the original scores object for phonics subscores
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
