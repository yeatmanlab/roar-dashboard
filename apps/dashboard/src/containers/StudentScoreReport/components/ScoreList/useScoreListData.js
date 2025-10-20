import { computed, toValue } from 'vue';
import ScoreReportService from '@/services/ScoreReport.service';
import { SCORE_TYPES } from '@/constants/scores';
import { getScoreValue } from '@/helpers/reports';
import { getStudentGradeLevel } from '@/helpers/getStudentGradeLevel';

/**
 * useScoreListData composable
 * Source of truth for Score List logic shared between ScoreList.vue and ScoreList.print.vue
 *
 * Params is a plain object to keep usage similar across both components.
 */
export function useScoreListData(params) {
  const { studentGrade, taskData, longitudinalData, t } = params;

  // Normalize grade once
  const gradeLevel = getStudentGradeLevel(studentGrade);

  // Build main task data
  const computedTaskData = computed(() => {
    const currentTasks = ScoreReportService.processTaskScores(taskData, gradeLevel, { t });

    const ld = toValue(longitudinalData);

    // Add phonics subscores if available
    const withSubscores = currentTasks.map((task) => {
      if (task.taskId === 'phonics' && task.scores?.composite?.subscores) {
        const subscores = task.scores.composite.subscores;
        const formattedSubscores = Object.fromEntries(
          Object.entries(subscores).map(([key, value]) => [key, `${value.correct}/${value.attempted}`]),
        );
        return {
          ...task,
          [task.scoreToDisplay]: {
            ...task[task.scoreToDisplay],
            subscores: formattedSubscores,
          },
        };
      }
      return task;
    });

    if (ld && Object.keys(ld).length > 0) {
      return withSubscores.map((task) => {
        const taskHistory = ld[task.taskId] || [];
        const processedHistory = [...taskHistory]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((run) => {
            const composite = run.scores?.composite || run.scores;
            const processedScores = {
              rawScore: getScoreValue(composite, task.taskId, gradeLevel, 'rawScore'),
              percentileScore: getScoreValue(composite, task.taskId, gradeLevel, 'percentile'),
              standardScore: getScoreValue(composite, task.taskId, gradeLevel, 'standardScore'),
            };

            const scores = Object.fromEntries(
              Object.entries(processedScores)
                .filter(([, value]) => value !== undefined)
                .map(([key, value]) => [key, Math.round(Number(value))]),
            );

            return {
              date: new Date(run.date),
              scores,
              assignmentId: run.assignmentId,
            };
          });

        return {
          ...task,
          historicalScores: processedHistory,
        };
      });
    }

    return withSubscores;
  });

  const scoreValueTemplate = computed(() => {
    return (task) => {
      const appendPercentageTo = ['phonics', 'letter', 'letter-es', 'letter-en-ca'];
      if (appendPercentageTo.includes(task.taskId)) {
        return task[task.scoreToDisplay].value + '%';
      }
      const percentileSuffix = ScoreReportService.getPercentileSuffixTemplate(task.percentileScore.value);
      return task.scoreToDisplay === SCORE_TYPES.PERCENTILE_SCORE ? percentileSuffix : undefined;
    };
  });

  const getTaskDescription = computed(() => {
    return (task) => ScoreReportService.getScoreDescription(task, gradeLevel, { t });
  });

  const getTaskScoresArray = computed(() => {
    return (task) => ScoreReportService.getScoresArrayForTask(task);
  });

  return {
    computedTaskData,
    scoreValueTemplate,
    getTaskDescription,
    getTaskScoresArray,
  };
}
