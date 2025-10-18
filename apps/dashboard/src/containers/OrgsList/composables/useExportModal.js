import { ref, computed } from 'vue';
import { CSV_EXPORT_BATCH_SIZE } from '@/constants/csvExport';
import { WARNING_LEVELS } from '../constants/exportConstants';

/**
 * Modal state management composable - handles UI state for export modal
 *
 * @returns {object} Modal state and computed properties
 */
export function useExportModal() {
  // Modal visibility
  const showExportConfirmation = ref(false);
  const showNoUsersModal = ref(false);
  const noUsersOrgName = ref('');

  // Export state
  const exportInProgress = ref(false);
  const exportComplete = ref(false);
  const exportSuccess = ref(false);
  const exportCancelled = ref(false);
  const exportError = ref('');
  const exportWarningLevel = ref(WARNING_LEVELS.NORMAL);

  // Export data
  const pendingExportData = ref(null);
  const exportWasBatched = ref(false);
  const exportBatchCount = ref(0);

  // Progress tracking (from export composable)
  const currentBatch = ref(0);
  const totalBatches = ref(0);

  // Button spinner state
  const exportingOrgId = ref(null);

  /**
   * Computed property to check if currently exporting org users
   */
  const isExportingOrgUsers = computed(() => exportingOrgId.value !== null);

  /**
   * Modal title based on current export state.
   */
  const exportModalTitle = computed(() => {
    switch (true) {
      case exportComplete.value && exportCancelled.value:
        return 'Export Cancelled';
      case exportComplete.value && exportSuccess.value:
        return 'Export Successful';
      case exportComplete.value && !exportSuccess.value:
        return 'Export Failed';
      case exportInProgress.value:
        return 'Exporting...';
      case exportWarningLevel.value === WARNING_LEVELS.CRITICAL:
        return 'Large Export Warning';
      case exportWarningLevel.value === WARNING_LEVELS.STRONG:
        return 'Export Warning';
      default:
        return 'Confirm Export';
    }
  });

  /**
   * Modal message based on current export state.
   */
  const exportModalMessage = computed(() => {
    const userCount = pendingExportData.value?.userCount || 0;
    const formattedCount = userCount.toLocaleString();
    const orgName = pendingExportData.value?.orgType?.name || '';

    // Complete state messages
    if (exportComplete.value) {
      switch (true) {
        case exportCancelled.value && totalBatches.value > 1 && currentBatch.value > 0:
          return `Export was cancelled after ${currentBatch.value} of ${totalBatches.value} batches were downloaded.\n\nYou may have partial data in the downloaded files.`;
        case exportCancelled.value:
          return 'Export was cancelled. No files were downloaded.';
        case exportSuccess.value && exportWasBatched.value:
          return `Users from ${orgName} have been exported successfully in ${exportBatchCount.value} separate CSV files!`;
        case exportSuccess.value:
          return `Users from ${orgName} have been exported successfully!`;
        default:
          return exportError.value || 'An unknown error occurred during export.';
      }
    }

    // In progress messages
    if (exportInProgress.value) {
      if (totalBatches.value > 1) {
        return `Exporting batch ${currentBatch.value} of ${totalBatches.value}...\n\nPlease wait while your files are being prepared.`;
      }
      return `Exporting ${formattedCount} users...\n\nPlease wait while your file is being prepared.`;
    }

    // Warning messages
    switch (exportWarningLevel.value) {
      case WARNING_LEVELS.CRITICAL: {
        const numBatches = Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE);
        return `This export contains ${formattedCount} users and will be split into ${numBatches} separate CSV files (${CSV_EXPORT_BATCH_SIZE.toLocaleString()} users each) to prevent your browser from becoming unresponsive.

The files will download one at a time and will be named:
• part-1-of-${numBatches}.csv
• part-2-of-${numBatches}.csv
• etc.

This may take several minutes to complete. If you prefer smaller exports, consider filtering by a smaller organization type (district, school, or class).`;
      }
      case WARNING_LEVELS.STRONG:
        return `This export contains ${formattedCount} users and may take 1-3 minutes to complete.

Consider filtering by a smaller organization if you need faster results.`;
      default:
        return `This export contains ${formattedCount} users and may take 30-60 seconds to complete.`;
    }
  });

  /**
   * Modal severity based on current export state.
   */
  const exportModalSeverity = computed(() => {
    if (exportComplete.value) {
      switch (true) {
        case exportCancelled.value:
          return 'warn';
        case exportSuccess.value:
          return 'success';
        default:
          return 'error';
      }
    }

    if (exportInProgress.value) {
      return 'info';
    }

    switch (exportWarningLevel.value) {
      case WARNING_LEVELS.CRITICAL:
      case WARNING_LEVELS.STRONG:
        return 'warn';
      default:
        return 'info';
    }
  });

  /**
   * Resets all modal state.
   */
  const resetModalState = () => {
    showExportConfirmation.value = false;
    pendingExportData.value = null;
    exportWarningLevel.value = WARNING_LEVELS.NORMAL;
    exportInProgress.value = false;
    exportComplete.value = false;
    exportSuccess.value = false;
    exportCancelled.value = false;
    exportError.value = '';
    currentBatch.value = 0;
    totalBatches.value = 0;
    exportWasBatched.value = false;
    exportBatchCount.value = 0;
    exportingOrgId.value = null;
  };

  /**
   * Resets completion states only.
   */
  const resetCompletionStates = () => {
    exportInProgress.value = false;
    exportComplete.value = false;
    exportSuccess.value = false;
    exportCancelled.value = false;
    exportError.value = '';
  };

  return {
    // State
    showExportConfirmation,
    showNoUsersModal,
    noUsersOrgName,
    exportInProgress,
    exportComplete,
    exportSuccess,
    exportCancelled,
    exportError,
    exportWarningLevel,
    pendingExportData,
    exportWasBatched,
    exportBatchCount,
    currentBatch,
    totalBatches,
    exportingOrgId,

    // Computed
    isExportingOrgUsers,
    exportModalTitle,
    exportModalMessage,
    exportModalSeverity,

    // Functions
    resetModalState,
    resetCompletionStates,
  };
}
