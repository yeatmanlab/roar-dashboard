import { ref } from 'vue';
import * as Sentry from '@sentry/vue';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import {
  CSV_EXPORT_WARNING_THRESHOLD,
  CSV_EXPORT_STRONG_WARNING_THRESHOLD,
  CSV_EXPORT_CRITICAL_THRESHOLD,
  CSV_EXPORT_BATCH_SIZE,
} from '@/constants/csvExport';
import { countUsersByOrg, fetchUsersByOrg } from '@/helpers/query/users';
import { exportCsv } from '@/helpers/query/utils';
import { WARNING_LEVELS } from '../constants/exportConstants';

/**
 * Pure export logic composable - handles data fetching and CSV generation
 *
 * @param {Ref<string>} activeOrgType - The active organization type
 * @param {Ref<object>} orderBy - The ordering configuration for queries
 * @returns {object} Export functions and utilities
 */
export function useOrgExport(activeOrgType, orderBy) {
  // Progress tracking
  const currentBatch = ref(0);
  const totalBatches = ref(0);
  const cancelRequested = ref(false);

  /**
   * Check if an object has a name property.
   */
  const hasNameProperty = (obj) => {
    return obj && typeof obj === 'object' && 'name' in obj;
  };

  /**
   * Determines the warning level based on user count.
   */
  const getExportWarningLevel = (userCount) => {
    if (userCount >= CSV_EXPORT_CRITICAL_THRESHOLD) return WARNING_LEVELS.CRITICAL;
    if (userCount >= CSV_EXPORT_STRONG_WARNING_THRESHOLD) return WARNING_LEVELS.STRONG;
    if (userCount >= CSV_EXPORT_WARNING_THRESHOLD) return WARNING_LEVELS.NORMAL;
    return WARNING_LEVELS.NONE;
  };

  /**
   * Transforms user data to export format.
   */
  const transformUsersForExport = (users) => {
    return users.map((user) => ({
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      FirstName: _get(user, 'name.first'),
      LastName: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
      Gender: _get(user, 'studentData.gender'),
      DateOfBirth: _get(user, 'studentData.dob'),
      UserType: _get(user, 'userType'),
      ell_status: _get(user, 'studentData.ell_status'),
      iep_status: _get(user, 'studentData.iep_status'),
      frl_status: _get(user, 'studentData.frl_status'),
      race: _get(user, 'studentData.race'),
      hispanic_ethnicity: _get(user, 'studentData.hispanic_ethnicity'),
      home_language: _get(user, 'studentData.home_language'),
    }));
  };

  /**
   * Counts users for an organization.
   */
  const countOrgUsers = async (orgType) => {
    try {
      return await countUsersByOrg(activeOrgType.value, orgType.id, orderBy);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  /**
   * Performs the actual CSV export.
   * For very large exports (>= critical threshold), splits into batches.
   * @param {Function} onProgress - Optional callback for progress updates
   */
  const performExport = async (orgType, userCount, onProgress) => {
    try {
      const needsBatching = userCount >= CSV_EXPORT_CRITICAL_THRESHOLD;

      if (needsBatching) {
        const numBatches = Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE);
        totalBatches.value = numBatches;

        for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
          if (cancelRequested.value) {
            return { cancelled: true, batchesCompleted: batchIndex };
          }

          currentBatch.value = batchIndex + 1;

          // Notify progress callback if provided
          if (onProgress) {
            onProgress(currentBatch.value, totalBatches.value);
          }

          const users = await fetchUsersByOrg(
            activeOrgType.value,
            orgType.id,
            CSV_EXPORT_BATCH_SIZE,
            batchIndex,
            orderBy,
          );

          if (cancelRequested.value) {
            return { cancelled: true, batchesCompleted: batchIndex };
          }

          const computedExportData = transformUsersForExport(users);
          const filename = `${_kebabCase(orgType.name)}-users-export-part-${batchIndex + 1}-of-${numBatches}.csv`;
          exportCsv(computedExportData, filename);

          if (batchIndex < numBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        return { success: true, batched: true, batchCount: numBatches };
      } else {
        const users = await fetchUsersByOrg(activeOrgType.value, orgType.id, userCount, 0, orderBy);

        if (cancelRequested.value) {
          return { cancelled: true };
        }

        const computedExportData = transformUsersForExport(users);
        exportCsv(computedExportData, `${_kebabCase(orgType.name)}-users-export.csv`);

        return { success: true, batched: false, batchCount: 1 };
      }
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  /**
   * Requests cancellation of ongoing export.
   */
  const requestCancel = () => {
    cancelRequested.value = true;
  };

  /**
   * Resets export state.
   */
  const resetExportState = () => {
    cancelRequested.value = false;
    currentBatch.value = 0;
    totalBatches.value = 0;
  };

  return {
    // State
    currentBatch,
    totalBatches,

    // Functions
    hasNameProperty,
    getExportWarningLevel,
    countOrgUsers,
    performExport,
    requestCancel,
    resetExportState,
  };
}
