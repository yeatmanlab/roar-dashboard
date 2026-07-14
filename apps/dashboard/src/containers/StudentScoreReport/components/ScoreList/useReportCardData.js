import { computed, toValue } from 'vue';
import _lowerCase from 'lodash/lowerCase';
import ScoreReportService from '@/services/ScoreReport.service';
import {
  rawOnlyTasks,
  taskDisplayNames,
  getRawScoreRange,
  tasksToDisplayPercentCorrect,
  PA_SUBTASK_I18N_KEYS,
} from '@/helpers/reports';
import { getStudentGradeLevel } from '@/helpers/getStudentGradeLevel';
import { SCORE_TYPES, SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';
import { TAG_SEVERITIES } from '@/constants/tags';

/**
 * useReportCardData composable
 *
 * Backend-sourced counterpart to `useScoreListData`. Builds the exact ScoreCard
 * prop contract (`computedTaskData` + the `scoreValueTemplate` / `getTaskDescription`
 * / `getTaskScoresArray` helpers) from the individual-student-report endpoint's
 * already-computed per-task values, retiring the client-side scoring pipeline
 * (`processTaskScores` / `getScoreValue` / `getDialColor`) for this path.
 *
 * The backend is the source of truth: score values come from `task.scores`, the
 * dial color from `task.supportLevel`, the longitudinal series from
 * `task.historicalScores` (already in the LongitudinalChart input shape), and the
 * reliability/type tags are derived from the backend `optional` / `reliable` /
 * `engagementFlags`.
 *
 * NOTE: the report endpoint carries subscores only for PA and phonics, so the
 * letter card's per-letter breakdown (upper/lower/sounds + "to work on") is not
 * reproduced here — its card shows the primary scores only. Tracked as a gap.
 *
 * @param {Object} params
 * @param {import('vue').MaybeRefOrGetter<Array>} params.reportTasks – Backend report tasks.
 * @param {import('vue').MaybeRefOrGetter<String>} params.studentGrade – Student grade.
 * @param {Object} params.taskScoringVersions – Map of task slug → scoring version.
 * @param {Function} params.t – i18n translate function.
 */
export function useReportCardData(params) {
  const { reportTasks, studentGrade, taskScoringVersions = {}, t } = params;

  const i18n = { t };
  const gradeLevel = getStudentGradeLevel(studentGrade);

  // The frontend owns the dial color for each backend support-level enum.
  const SUPPORT_LEVEL_DIAL_COLOR = {
    achievedSkill: SCORE_SUPPORT_LEVEL_COLORS.ABOVE,
    developingSkill: SCORE_SUPPORT_LEVEL_COLORS.SOME,
    needsExtraSupport: SCORE_SUPPORT_LEVEL_COLORS.BELOW,
  };

  // The backend `display` descriptor's score type maps to a card score key; its stable
  // label maps to the localized name. ('percentCorrect' is shown in the percentile slot,
  // matching how the cards present percent-correct tasks.)
  const DISPLAY_TYPE_TO_CARD_KEY = {
    percentile: SCORE_TYPES.PERCENTILE_SCORE,
    standardScore: SCORE_TYPES.STANDARD_SCORE,
    rawScore: SCORE_TYPES.RAW_SCORE,
    percentCorrect: SCORE_TYPES.PERCENTILE_SCORE,
  };
  const DISPLAY_LABEL_I18N = {
    Percentile: 'scoreReports.percentileScore',
    'Standard Score': 'scoreReports.standardScore',
    'Raw Score': 'scoreReports.rawScore',
    'Percent Correct': 'scoreReports.percentCorrect',
  };

  // Which score type the card surfaces (mirrors ScoreReport.service.getScoreToDisplay).
  const getScoreToDisplay = (slug, grade) => {
    if (rawOnlyTasks.includes(slug)) return SCORE_TYPES.RAW_SCORE;
    if (['phonics', 'letter', 'letter-es', 'letter-en-ca'].includes(slug)) return SCORE_TYPES.PERCENTILE_SCORE;
    return toValue(grade) >= 6 ? SCORE_TYPES.STANDARD_SCORE : SCORE_TYPES.PERCENTILE_SCORE;
  };

  // Type + reliability tags, derived from backend flags (mirrors the service's createTaskTags).
  const buildTags = (optional, reliable, engagementFlags) => [
    {
      icon: 'pi pi-info-circle',
      label: 'Type',
      value: t(optional ? 'scoreReports.optional' : 'scoreReports.required'),
      severity: TAG_SEVERITIES.INFO,
      tooltip: t(optional ? 'scoreReports.optionalTagText' : 'scoreReports.requiredTagText'),
    },
    {
      value: t(reliable === false ? 'scoreReports.unreliable' : 'scoreReports.reliable'),
      label: 'Reliability',
      icon: reliable === false ? 'pi pi-times' : 'pi pi-check',
      severity: reliable === false ? TAG_SEVERITIES.DANGER : TAG_SEVERITIES.SUCCESS,
      tooltip:
        reliable === false
          ? engagementFlags?.length
            ? `${t('scoreReports.unreliableTagTextFlags')}: \n\n${engagementFlags.map((flag) => _lowerCase(flag)).join(', ')}`
            : t('scoreReports.unreliableTagText')
          : t('scoreReports.reliableTagText'),
    },
  ];

  const round = (value) => (value == null ? null : Math.round(value));

  const buildEntry = (task) => {
    const slug = task.taskSlug;
    const grade = gradeLevel;
    const useSpanishNorms = (slug === 'swr-es' || slug === 'sre-es') && taskScoringVersions[slug] >= 1;
    // Optional tasks render a neutral dial (matching legacy getDialColor, which returns no
    // color for optional tasks) even though the backend classifies a completed optional task.
    const dialColor = task.optional
      ? undefined
      : (SUPPORT_LEVEL_DIAL_COLOR[task.supportLevel] ?? SCORE_SUPPORT_LEVEL_COLORS.ASSESSED);
    const rawRange = getRawScoreRange(slug);

    const scoresForTask = {
      standardScore: {
        name: t('scoreReports.standardScore'),
        value: round(task.scores?.standardScore),
        min: 0,
        max: 180,
        supportColor: dialColor,
      },
      rawScore: {
        name: t('scoreReports.rawScore'),
        value: round(task.scores?.rawScore),
        min: rawRange?.min,
        max: rawRange?.max,
        supportColor: dialColor,
      },
      percentileScore: {
        name:
          tasksToDisplayPercentCorrect.includes(slug) && !useSpanishNorms
            ? t('scoreReports.percentCorrect')
            : t('scoreReports.percentileScore'),
        value: round(task.scores?.percentile),
        min: 0,
        max: slug.includes('letter') ? 100 : 99,
        supportColor: dialColor,
      },
    };

    // Phonics renders its subscores via `score.subscores` on the displayed score.
    if (slug === 'phonics' && task.subscores) {
      scoresForTask.percentileScore.subscores = Object.fromEntries(
        Object.entries(task.subscores).map(([key, value]) => [key, `${value.correct}/${value.attempted}`]),
      );
    }

    // Primary display: when the backend supplies a `display` descriptor it owns the displayed
    // score's value, label, and range — retiring the client getScoreToDisplay / getRawScoreRange
    // / useSpanishNorms logic for it. For the authored tasks `display.scoreType` resolves to the
    // same slot the grade/version rule already picks (percentCorrect → percentile slot; normed →
    // percentile/standard by grade), so this mainly moves the label + range to the backend.
    // Mutated in place *before* the breakdown rows below, so the displayed-type breakdown row
    // reads the same value/range as the dial. Falls back to the client derivation when `display`
    // is absent (not-yet-authored tasks, or before the backend ships).
    // NOTE: getTaskDescription still derives its prose from grade + scoringVersion, which agrees
    // with `display` by construction; sourcing the description from `display` too is a follow-up.
    let scoreToDisplay = getScoreToDisplay(slug, grade);
    if (task.display) {
      const cardKey = DISPLAY_TYPE_TO_CARD_KEY[task.display.scoreType] ?? scoreToDisplay;
      const card = scoresForTask[cardKey];
      if (card) {
        card.value = round(task.display.value);
        const labelKey = DISPLAY_LABEL_I18N[task.display.label];
        if (labelKey) card.name = t(labelKey);
        if (task.display.range) {
          card.min = task.display.range.min;
          card.max = task.display.range.max;
        }
      }
      scoreToDisplay = cardKey;
    }

    // Score-breakdown rows: standard, percentile (grade < 6 only), raw — the order the
    // legacy createScoresArray sorts to. Letter/PA granular rows are a known gap.
    const scoresArray = [
      [
        scoresForTask.standardScore.name,
        scoresForTask.standardScore.value,
        scoresForTask.standardScore.min,
        scoresForTask.standardScore.max,
      ],
    ];
    if (grade < 6) {
      scoresArray.push([
        scoresForTask.percentileScore.name,
        scoresForTask.percentileScore.value,
        scoresForTask.percentileScore.min,
        scoresForTask.percentileScore.max,
      ]);
    }
    scoresArray.push([
      scoresForTask.rawScore.name,
      scoresForTask.rawScore.value,
      scoresForTask.rawScore.min,
      scoresForTask.rawScore.max,
    ]);
    if (slug === 'pa' && task.skillsToWorkOn) {
      const skills = task.skillsToWorkOn.map((key) => t(PA_SUBTASK_I18N_KEYS[key] ?? key));
      scoresArray.push([t('scoreReports.skillsToWorkOn'), skills.join(', ') || t('scoreReports.none')]);
    }

    return {
      taskId: slug,
      scoreToDisplay,
      ...scoresForTask,
      tags: buildTags(task.optional, task.reliable, task.engagementFlags),
      scores: task.scores,
      // Already in the LongitudinalChart input shape ({ date, scores, administrationId }).
      historicalScores: task.historicalScores ?? [],
      scoresArray,
    };
  };

  const computedTaskData = computed(() => {
    const tasks = toValue(reportTasks) ?? [];
    return tasks
      .filter((task) => task.scores?.rawScore != null && !['vocab', 'cva'].includes(task.taskSlug))
      .map(buildEntry)
      .sort((a, b) => (taskDisplayNames[a.taskId]?.order ?? 99) - (taskDisplayNames[b.taskId]?.order ?? 99));
  });

  const scoreValueTemplate = computed(() => (task) => {
    const appendPercentageTo = ['phonics', 'letter', 'letter-es', 'letter-en-ca'];
    if (appendPercentageTo.includes(task.taskId)) {
      const value = task[task.scoreToDisplay].value;
      return value == null ? '' : value + '%';
    }
    return task.scoreToDisplay === SCORE_TYPES.PERCENTILE_SCORE
      ? ScoreReportService.getPercentileSuffixTemplate(task.percentileScore.value, i18n)
      : undefined;
  });

  // Reuse the service's text builders; they read the per-score `.value` fields we
  // populated from the backend, so no client re-scoring is involved.
  const getTaskDescription = computed(
    () => (task) => ScoreReportService.getScoreDescription(task, gradeLevel, i18n, taskScoringVersions[task.taskId]),
  );

  const getTaskScoresArray = computed(() => (task) => ScoreReportService.getScoresArrayForTask(task));

  return { computedTaskData, scoreValueTemplate, getTaskDescription, getTaskScoresArray };
}
