import { computed } from 'vue';
import { PROGRESS_STATUS } from '../constants/progressReportConstants';

/**
 * Maps a backend 7-level `ProgressStatus` to the report's display PROGRESS_STATUS.
 *
 * The progress (assigned → started → completed) and requirement (required vs
 * optional) axes are orthogonal in the API. The Progress Report renders a single
 * tag per task and — preserving the legacy behavior — surfaces the OPTIONAL state
 * ahead of progress: any optional task shows "Optional" regardless of whether a
 * run exists. Required tasks show their progress state.
 *
 * @param {string} status – one of the six visible ProgressStatus values.
 * @returns {object} the matching PROGRESS_STATUS descriptor.
 */
function mapProgressStatus(status) {
  if (status?.endsWith('-optional')) return PROGRESS_STATUS.OPTIONAL;
  if (status?.startsWith('completed')) return PROGRESS_STATUS.COMPLETED;
  if (status?.startsWith('started')) return PROGRESS_STATUS.STARTED;
  return PROGRESS_STATUS.ASSIGNED;
}

/**
 * Progress Report Data Composable
 *
 * Transforms per-student progress rows from the ROAR backend
 * (`GET /administrations/:id/reports/progress/students`, via
 * `useAdministrationProgressQuery`) into table rows for the RoarDataTable.
 *
 * Progress is keyed by task UUID; each entry carries the display descriptor
 * (value/icon/severity/tag) plus a `tags` string consumed by the table's
 * tag-based column filter. `schoolName` is provided directly by the API
 * (populated for district scope only), so no school dictionary is needed.
 *
 * @param {import('vue').Ref} students – Student progress rows from useAdministrationProgressQuery.
 * @returns {Object} `{ computedProgressData }`
 */
export function useProgressData(students) {
  const computedProgressData = computed(() => {
    if (!students.value) return [];

    return students.value.map(({ user, progress }) => {
      const currRowProgress = {};
      for (const taskId of Object.keys(progress ?? {})) {
        const descriptor = mapProgressStatus(progress[taskId]?.status);
        currRowProgress[taskId] = {
          ...descriptor,
          tags: ` ${descriptor.tag} `,
        };
      }

      return {
        user: {
          username: user.username,
          email: user.email,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          grade: user.grade,
          assessmentPid: user.assessmentPid,
          schoolName: user.schoolName,
        },
        routeParams: {
          userId: user.userId,
        },
        launchTooltip: `View assessment portal for ${user.firstName ?? user.username ?? 'user'}`,
        progress: currRowProgress,
      };
    });
  });

  return {
    computedProgressData,
  };
}
