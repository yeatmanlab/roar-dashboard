import { ref, computed } from 'vue';
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

/**
 * Composable for handling organization user exports with tiered warnings and batching.
 *
 * @param {Ref<string>} activeOrgType - The active organization type (districts, schools, etc.)
 * @param {Ref<object>} orderBy - The ordering configuration for queries
 * @returns {object} Export state, functions, and computed properties
 */
export function useOrgExport(activeOrgType, orderBy) {
  // ===== State =====

  // Modal state
  const showExportConfirmation = ref(false);
  const pendingExportData = ref(null);
  const exportWarningLevel = ref('normal'); // 'normal', 'strong', 'critical'
  const exportInProgress = ref(false);
  const exportComplete = ref(false);
  const exportSuccess = ref(false);
  const exportCancelled = ref(false);
  const exportError = ref('');

  // No users modal state
  const showNoUsersModal = ref(false);
  const noUsersOrgName = ref('');

  // Cancellation state
  const cancelRequested = ref(false);

  // Export result state
  const exportWasBatched = ref(false);
  const exportBatchCount = ref(0);

  // Progress tracking
  const currentBatch = ref(0);
  const totalBatches = ref(0);

  // Button spinner state
  const exportingOrgId = ref(null);

  // ===== Helper Functions =====

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
    if (userCount >= CSV_EXPORT_CRITICAL_THRESHOLD) return 'critical';
    if (userCount >= CSV_EXPORT_STRONG_WARNING_THRESHOLD) return 'strong';
    if (userCount >= CSV_EXPORT_WARNING_THRESHOLD) return 'normal';
    return 'none';
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

  // ===== Core Export Functions =====

  /**
   * Performs the actual CSV export after confirmation.
   * For very large exports (>= critical threshold), splits into batches.
   */
  const performExport = async (data) => {
    const { orgType, userCount } = data;

    try {
      // Check if we need to batch the export
      const needsBatching = userCount >= CSV_EXPORT_CRITICAL_THRESHOLD;

      if (needsBatching) {
        // Calculate number of batches needed
        const numBatches = Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE);
        totalBatches.value = numBatches;

        // Export each batch
        for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
          // Check if cancellation was requested
          if (cancelRequested.value) {
            exportComplete.value = true;
            exportSuccess.value = false;
            exportCancelled.value = true;
            return;
          }

          currentBatch.value = batchIndex + 1;

          // Fetch users for this batch using pagination
          const users = await fetchUsersByOrg(
            activeOrgType.value,
            orgType.id,
            CSV_EXPORT_BATCH_SIZE,
            ref(batchIndex),
            orderBy,
          );

          // Check again after async operation
          if (cancelRequested.value) {
            exportComplete.value = true;
            exportSuccess.value = false;
            exportCancelled.value = true;
            return;
          }

          const computedExportData = transformUsersForExport(users);

          // Export with batch number in filename
          const filename = `${_kebabCase(orgType.name)}-users-export-part-${batchIndex + 1}-of-${numBatches}.csv`;
          exportCsv(computedExportData, filename);

          // Small delay between batches to prevent browser lockup
          if (batchIndex < numBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      } else {
        // Single export for smaller datasets
        const users = await fetchUsersByOrg(activeOrgType.value, orgType.id, userCount, ref(0), orderBy);

        // Check if cancelled during fetch
        if (cancelRequested.value) {
          exportComplete.value = true;
          exportSuccess.value = false;
          exportCancelled.value = true;
          return;
        }

        const computedExportData = transformUsersForExport(users);
        exportCsv(computedExportData, `${_kebabCase(orgType.name)}-users-export.csv`);
      }

      // Mark export as complete and successful (only if not cancelled)
      if (!cancelRequested.value) {
        exportComplete.value = true;
        exportSuccess.value = true;
        exportWasBatched.value = needsBatching;
        exportBatchCount.value = needsBatching ? Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE) : 1;
      }
    } catch (error) {
      // Mark export as complete but failed
      exportComplete.value = true;
      exportSuccess.value = false;
      exportCancelled.value = false;
      exportError.value = error.message;
      Sentry.captureException(error);
    } finally {
      exportInProgress.value = false;
      cancelRequested.value = false;
      // Keep currentBatch/totalBatches for display in modal
    }
  };

  /**
   * Initiates the export process with tiered warnings based on user count.
   */
  const exportOrgUsers = async (orgType) => {
    if (!orgType) return;

    // Set exporting org ID for button spinner
    exportingOrgId.value = orgType.id;

    try {
      // First, count the users
      const userCount = await countUsersByOrg(activeOrgType.value, orgType.id, orderBy);

      if (userCount === 0) {
        noUsersOrgName.value = hasNameProperty(orgType) ? orgType.name : 'this organization';
        showNoUsersModal.value = true;
        exportingOrgId.value = null;
        return;
      }

      const warningLevel = getExportWarningLevel(userCount);

      // If no warning needed, export immediately
      if (warningLevel === 'none') {
        await performExport({ orgType, userCount });
        exportingOrgId.value = null;
        return;
      }

      // Show confirmation modal for larger exports
      // Reset any previous completion states
      exportInProgress.value = false;
      exportComplete.value = false;
      exportSuccess.value = false;
      exportCancelled.value = false;
      exportError.value = '';

      pendingExportData.value = { orgType, userCount };
      exportWarningLevel.value = warningLevel;
      showExportConfirmation.value = true;
    } catch (error) {
      // Show error in modal for counting/initialization errors
      exportComplete.value = true;
      exportSuccess.value = false;
      exportError.value = error.message;
      showExportConfirmation.value = true;
      Sentry.captureException(error);
    }
  };

  /**
   * Handles user confirmation to proceed with export.
   * Keeps modal open and updates content to show progress.
   */
  const confirmExport = async () => {
    if (!pendingExportData.value) return;

    // Switch modal to progress mode
    exportInProgress.value = true;
    exportComplete.value = false;
    exportSuccess.value = false;
    exportCancelled.value = false;
    exportError.value = '';
    cancelRequested.value = false;

    // Perform the export (modal stays open)
    await performExport(pendingExportData.value);
  };

  /**
   * Handles user request to cancel ongoing export.
   */
  const requestCancelExport = () => {
    cancelRequested.value = true;
  };

  /**
   * Handles user cancellation of export or closing after completion.
   */
  const cancelExport = () => {
    showExportConfirmation.value = false;
    pendingExportData.value = null;
    exportWarningLevel.value = 'normal';
    exportInProgress.value = false;
    exportComplete.value = false;
    exportSuccess.value = false;
    exportCancelled.value = false;
    exportError.value = '';
    cancelRequested.value = false;
    currentBatch.value = 0;
    totalBatches.value = 0;
    exportWasBatched.value = false;
    exportBatchCount.value = 0;
    exportingOrgId.value = null;
  };

  // ===== Computed Properties =====

  /**
   * Modal title based on current export state.
   */
  const exportModalTitle = computed(() => {
    if (exportComplete.value) {
      if (exportCancelled.value) return 'Export Cancelled';
      return exportSuccess.value ? 'Export Successful' : 'Export Failed';
    }
    if (exportInProgress.value) {
      return 'Exporting...';
    }
    if (exportWarningLevel.value === 'critical') return 'Large Export Warning';
    if (exportWarningLevel.value === 'strong') return 'Export Warning';
    return 'Confirm Export';
  });

  /**
   * Modal message based on current export state.
   */
  const exportModalMessage = computed(() => {
    const userCount = pendingExportData.value?.userCount || 0;
    const formattedCount = userCount.toLocaleString();
    const orgName = pendingExportData.value?.orgType?.name || '';

    // Show result message if export is complete
    if (exportComplete.value) {
      if (exportCancelled.value) {
        if (totalBatches.value > 1 && currentBatch.value > 0) {
          return `Export was cancelled after ${currentBatch.value} of ${totalBatches.value} batches were downloaded.\n\nYou may have partial data in the downloaded files.`;
        }
        return `Export was cancelled. No files were downloaded.`;
      }
      if (exportSuccess.value) {
        if (exportWasBatched.value) {
          return `Users from ${orgName} have been exported successfully in ${exportBatchCount.value} separate CSV files!`;
        }
        return `Users from ${orgName} have been exported successfully!`;
      } else {
        return exportError.value || 'An unknown error occurred during export.';
      }
    }

    // Show progress message if export is in progress
    if (exportInProgress.value) {
      if (totalBatches.value > 1) {
        return `Exporting batch ${currentBatch.value} of ${totalBatches.value}...\n\nPlease wait while your files are being prepared.`;
      }
      return `Exporting ${formattedCount} users...\n\nPlease wait while your file is being prepared.`;
    }

    // Show warning message before export starts
    if (exportWarningLevel.value === 'critical') {
      const numBatches = Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE);
      return `This export contains ${formattedCount} users and will be split into ${numBatches} separate CSV files (${CSV_EXPORT_BATCH_SIZE.toLocaleString()} users each) to prevent your browser from becoming unresponsive.

The files will download one at a time and will be named:
• part-1-of-${numBatches}.csv
• part-2-of-${numBatches}.csv
• etc.

This may take several minutes to complete. If you prefer smaller exports, consider filtering by a smaller organization type (district, school, or class).`;
    }

    if (exportWarningLevel.value === 'strong') {
      return `This export contains ${formattedCount} users and may take 1-3 minutes to complete.

Consider filtering by a smaller organization if you need faster results.`;
    }

    return `This export contains ${formattedCount} users and may take 30-60 seconds to complete.`;
  });

  /**
   * Modal severity based on current export state.
   */
  const exportModalSeverity = computed(() => {
    if (exportComplete.value) {
      if (exportCancelled.value) return 'warn';
      return exportSuccess.value ? 'success' : 'error';
    }
    if (exportInProgress.value) return 'info';
    if (exportWarningLevel.value === 'critical') return 'warn';
    if (exportWarningLevel.value === 'strong') return 'warn';
    return 'info';
  });

  // ===== Return Public API =====

  return {
    // State
    showExportConfirmation,
    exportInProgress,
    exportComplete,
    exportSuccess,
    exportCancelled,
    exportWarningLevel,
    exportingOrgId,
    showNoUsersModal,
    noUsersOrgName,
    currentBatch,
    totalBatches,

    // Functions
    exportOrgUsers,
    confirmExport,
    cancelExport,
    requestCancelExport,

    // Computed
    exportModalTitle,
    exportModalMessage,
    exportModalSeverity,
  };
}
