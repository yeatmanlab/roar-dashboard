import { toValue } from 'vue';
import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import { exportCsv } from '@/helpers/query/utils';

/**
 * Progress Report Export Composable
 *
 * Handles CSV export functionality for progress report data. The progress map is
 * keyed by task UUID, so per-task column headers are resolved from the API `tasks`
 * metadata (friendly name via the task dictionary, falling back to the API name).
 *
 * @param {import('vue').ComputedRef} computedProgressData - The computed progress data.
 * @param {import('vue').Ref} tasks - Report task metadata array from the progress API.
 * @param {import('vue').Ref} tasksDictionary - Dictionary of task display names (keyed by task slug).
 * @param {import('vue').Ref} administrationData - Administration data.
 * @param {import('vue').Ref} orgData - Organization data.
 * @param {import('vue').ComputedRef} displayName - Display name for the administration.
 * @param {Object} authStore - Auth store instance.
 * @param {String} orgType - Organization type (district, school, etc.).
 * @returns {Object} Export functions.
 */
export function useProgressExport(
  computedProgressData,
  tasks,
  tasksDictionary,
  administrationData,
  orgData,
  displayName,
  authStore,
  orgType,
) {
  // Map each task UUID to a friendly header for the CSV columns.
  const buildTaskNameByUuid = () =>
    (toValue(tasks) ?? []).reduce((acc, task) => {
      acc[task.taskId] = tasksDictionary.value?.[task.taskSlug]?.nameSimple ?? task.taskName;
      return acc;
    }, {});

  const buildExportRow = (user, progress, taskNameByUuid) => {
    let tableRow = {
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };

    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }

    if (orgType === 'district') {
      tableRow['School'] = _get(user, 'schoolName');
    }

    for (const taskId in progress) {
      tableRow[taskNameByUuid[taskId] ?? taskId] = progress[taskId].value;
    }

    return tableRow;
  };

  const exportSelected = (selectedRows) => {
    const taskNameByUuid = buildTaskNameByUuid();
    const computedExportData = _map(selectedRows, ({ user, progress }) => {
      return buildExportRow(user, progress, taskNameByUuid);
    });
    exportCsv(computedExportData, 'roar-progress-selected.csv');
  };

  const exportAll = () => {
    const taskNameByUuid = buildTaskNameByUuid();
    const computedExportData = _map(computedProgressData.value, ({ user, progress }) => {
      return buildExportRow(user, progress, taskNameByUuid);
    });

    const fileName = `roar-progress-${_kebabCase(displayName.value)}-${_kebabCase(orgData.value.name)}.csv`;
    exportCsv(computedExportData, fileName);
  };

  return {
    exportSelected,
    exportAll,
  };
}
