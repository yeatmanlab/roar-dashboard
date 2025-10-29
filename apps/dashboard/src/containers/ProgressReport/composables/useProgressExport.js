import _get from 'lodash/get';
import _map from 'lodash/map';
import _kebabCase from 'lodash/kebabCase';
import { exportCsv } from '@/helpers/query/utils';

/**
 * Progress Report Export Composable
 *
 * Handles CSV export functionality for progress report data.
 *
 * @param {import('vue').ComputedRef} computedProgressData - The computed progress data
 * @param {import('vue').Ref} tasksDictionary - Dictionary of task information
 * @param {import('vue').Ref} administrationData - Administration data
 * @param {import('vue').Ref} orgData - Organization data
 * @param {import('vue').ComputedRef} displayName - Display name for the administration
 * @param {Object} authStore - Auth store instance
 * @param {String} orgType - Organization type (district, school, etc.)
 * @returns {Object} Export functions
 */
export function useProgressExport(
  computedProgressData,
  tasksDictionary,
  administrationData,
  orgData,
  displayName,
  authStore,
  orgType,
) {
  const buildExportRow = (user, progress) => {
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
      tableRow[tasksDictionary.value[taskId]?.publicName ?? taskId] = progress[taskId].value;
    }

    return tableRow;
  };

  const exportSelected = (selectedRows) => {
    const computedExportData = _map(selectedRows, ({ user, progress }) => {
      return buildExportRow(user, progress);
    });
    exportCsv(computedExportData, 'roar-progress-selected.csv');
  };

  const exportAll = () => {
    const computedExportData = _map(computedProgressData.value, ({ user, progress }) => {
      return buildExportRow(user, progress);
    });

    const fileName = `roar-progress-${_kebabCase(displayName.value)}-${_kebabCase(orgData.value.name)}.csv`;
    exportCsv(computedExportData, fileName);
  };

  return {
    exportSelected,
    exportAll,
  };
}
