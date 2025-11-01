import { computed } from 'vue';
import { PROGRESS_STATUS } from '../constants/progressReportConstants';

/**
 * Progress Report Data Composable
 *
 * Transforms raw assignment data into structured table rows with progress information.
 *
 * @param {import('vue').Ref} assignmentData - Raw assignment data from the API
 * @param {import('vue').ComputedRef} schoolNameDictionary - Dictionary mapping school IDs to names
 * @returns {Object} Computed progress data
 */
export function useProgressData(assignmentData, schoolNameDictionary) {
  const computedProgressData = computed(() => {
    if (!assignmentData.value) return [];

    const assignmentTableDataAcc = [];

    for (const { assignment, user } of assignmentData.value) {
      const grade = String(assignment.userData?.grade);

      // Compute schoolName
      let schoolName = '';
      const schoolId = user?.schools?.current[0];
      if (schoolId) {
        schoolName = schoolNameDictionary.value[schoolId];
      }

      const currRow = {
        user: {
          username: user.username,
          email: user.email,
          userId: user.userId,
          firstName: user.name?.first,
          lastName: user.name?.last,
          grade: grade,
          assessmentPid: user.assessmentPid,
          schoolName: schoolName,
        },
        routeParams: {
          userId: user.userId,
        },
        launchTooltip: `View assessment portal for ${user.name?.first || user.username}`,
      };

      const currRowProgress = {};
      for (const assessment of assignment.assessments) {
        let progressFilterTags = '';
        const taskId = assessment.taskId;

        if (assessment?.optional) {
          currRowProgress[taskId] = {
            ...PROGRESS_STATUS.OPTIONAL,
          };
          progressFilterTags += ` ${PROGRESS_STATUS.OPTIONAL.tag} `;
        } else if (assessment?.completedOn !== undefined) {
          currRowProgress[taskId] = {
            ...PROGRESS_STATUS.COMPLETED,
          };
          progressFilterTags += ` ${PROGRESS_STATUS.COMPLETED.tag} `;
        } else if (assessment?.startedOn !== undefined) {
          currRowProgress[taskId] = {
            ...PROGRESS_STATUS.STARTED,
          };
          progressFilterTags += ` ${PROGRESS_STATUS.STARTED.tag} `;
        } else {
          currRowProgress[taskId] = {
            ...PROGRESS_STATUS.ASSIGNED,
          };
          progressFilterTags += ` ${PROGRESS_STATUS.ASSIGNED.tag} `;
        }
        currRowProgress[taskId].tags = progressFilterTags;

        // Update progress for current row with computed object
        currRow.progress = currRowProgress;
      }
      assignmentTableDataAcc.push(currRow);
    }

    return assignmentTableDataAcc;
  });

  return {
    computedProgressData,
  };
}
