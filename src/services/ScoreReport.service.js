import _lowerCase from 'lodash/lowerCase';
import _startCase from 'lodash/startCase';
import _toUpper from 'lodash/toUpper';
import _get from 'lodash/get';
import {
  rawOnlyTasks,
  taskDisplayNames,
  extendedDescriptions,
  getSupportLevel,
  getRawScoreRange,
  getScoreKeys,
} from '@/helpers/reports';
import { TAG_SEVERITIES } from '@/constants/tags';
import { SCORE_SUPPORT_SKILL_LEVELS, SCORE_TYPES } from '@/constants/scores';

export const ScoreReportService = (() => {
  /**
   * Format percentile with appropriate suffix (1st, 2nd, 3rd, etc.)
   *
   * @param {number} percentile - Percentile value
   * @returns {string} Formatted percentile with suffix
   */
  const getPercentileWithSuffix = (percentile) => {
    if (percentile % 10 === 1 && percentile !== 11) return percentile + 'st';
    if (percentile % 10 === 2 && percentile !== 12) return percentile + 'nd';
    if (percentile % 10 === 3 && percentile !== 13) return percentile + 'rd';
    return percentile + 'th';
  };

  /**
   * Get template string for percentile display
   *
   * @param {number} percentile - Percentile value
   * @returns {string} Template string for display
   */
  const getPercentileSuffixTemplate = (percentile) => {
    if (percentile % 10 === 1 && percentile !== 11) return '{value}st';
    if (percentile % 10 === 2 && percentile !== 12) return '{value}nd';
    if (percentile % 10 === 3 && percentile !== 13) return '{value}rd';
    return '{value}th';
  };

  /**
   * Get support level language based on student performance
   *
   * @param {number} grade - Student grade
   * @param {number} percentile - Percentile score
   * @param {number} rawScore - Raw score
   * @param {string} taskId - Task identifier
   * @param {Object} i18n - i18n instance for translations
   * @returns {string} Support level text
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
   * Generate description object for a task score
   * @param {Object} task - Task data
   * @param {number} grade - Student grade
   * @param {string} studentFirstName - Student's first name
   * @param {Object} i18n - i18n instance for translations
   * @returns {Object} Description object with keypath and slots
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
   * Create tags for a task
   *
   * @param {boolean} optional - Whether task is optional
   * @param {boolean} reliable - Whether task results are reliable
   * @param {Object} engagementFlags - Engagement flags if any
   * @param {Object} i18n - i18n instance for translations
   * @returns {Array} Array of tag objects
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
      const { percentileScoreKey, standardScoreKey, rawScoreKey } = getScoreKeys(taskId, grade);
      const compositeScores = scores?.composite;
      let rawScore = null;

      if (!taskId.includes('vocab') && !taskId.includes('es')) {
        rawScore = taskId.includes('letter')
          ? _get(compositeScores, 'totalCorrect')
          : _get(compositeScores, rawScoreKey);
      } else {
        rawScore = compositeScores;
      }

      if (!isNaN(rawScore) && !tasksBlacklist.includes(taskId)) {
        const percentileScore = _get(compositeScores, percentileScoreKey);
        const standardScore = _get(compositeScores, standardScoreKey);
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
        };

        computedTaskAcc[taskId].scoresArray = createScoresArray(taskId, scoresForTask, scores, grade, i18n);
      }
    }

    return Object.keys(computedTaskAcc)
      .sort((a, b) => taskDisplayNames[a].order - taskDisplayNames[b].order)
      .map((taskId) => computedTaskAcc[taskId]);
  };

  /**
   * Create scores array for a task
   *
   * @TODO: Replace hard-coded task IDs with constants
   *
   * @param {string} taskId - Task identifier
   * @param {Object} scoresForTask - Scores object
   * @param {Object} scores - Raw scores data
   * @param {number} grade - Student grade
   * @param {Object} i18n - i18n instance for translations
   *
   * @returns {Array} Formatted scores array
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
      const incorrectLetters = [
        scores?.UppercaseNames?.upperIncorrect ?? '',
        scores?.LowercaseNames?.lowerIncorrect ?? '',
      ]
        .flat()
        .sort((a, b) => _toUpper(a).localeCompare(_toUpper(b)))
        .filter(Boolean)
        .join(', ');

      const incorrectPhonemes = (scores?.Phonemes?.phonemeIncorrect ?? []).join(', ');

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

  return {
    getPercentileWithSuffix,
    getPercentileSuffixTemplate,
    getSupportLevelLanguage,
    getScoreDescription,
    getScoresArrayForTask,
    createTaskTags,
    processTaskScores,
  };
})();
