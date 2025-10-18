import { ref, computed } from 'vue';
import { CSV_EXPORT_BATCH_SIZE } from '@/constants/csvExport';
import { WARNING_LEVELS, EXPORT_PHASE } from '../constants/exportConstants';

/**
 * Modal state management composable - handles UI state for export modal
 *
 * @returns {object} Modal state and computed properties
 */
export function useExportModal() {
  // Modal visibility state
  const modalState = ref({
    showExportConfirmation: false,
    showNoUsersModal: false,
    noUsersOrgName: '',
  });

  // Export phase and status
  const exportPhase = ref(EXPORT_PHASE.IDLE);
  const exportError = ref('');
  const exportWarningLevel = ref(WARNING_LEVELS.NORMAL);

  // Export data and configuration
  const exportData = ref({
    pendingExportData: null,
    exportWasBatched: false,
    exportBatchCount: 0,
  });

  // Progress tracking
  const progressState = ref({
    currentBatch: 0,
    totalBatches: 0,
  });

  // Button spinner state
  const exportingOrgId = ref(null);

  /**
   * Computed property to check if currently exporting org users
   */
  const isExportingOrgUsers = computed(() => exportingOrgId.value !== null);

  /**
   * Modal title based on current export phase.
   */
  const exportModalTitle = computed(() => {
    switch (exportPhase.value) {
      case EXPORT_PHASE.CANCELLED:
        return 'Export Cancelled';
      case EXPORT_PHASE.SUCCESS:
        return 'Export Successful';
      case EXPORT_PHASE.FAILED:
        return 'Export Failed';
      case EXPORT_PHASE.IN_PROGRESS:
        return 'Exporting...';
      case EXPORT_PHASE.IDLE:
        if (exportWarningLevel.value === WARNING_LEVELS.CRITICAL) {
          return 'Large Export Warning';
        }
        if (exportWarningLevel.value === WARNING_LEVELS.STRONG) {
          return 'Export Warning';
        }
        return 'Confirm Export';
      default:
        return 'Confirm Export';
    }
  });

  /**
   * Modal message based on current export phase.
   */
  const exportModalMessage = computed(() => {
    const userCount = exportData.value.pendingExportData?.userCount || 0;
    const formattedCount = userCount.toLocaleString();
    const orgName = exportData.value.pendingExportData?.orgType?.name || '';

    // Completion phase messages
    if (exportPhase.value === EXPORT_PHASE.CANCELLED) {
      if (progressState.value.totalBatches > 1 && progressState.value.currentBatch > 0) {
        return `Export was cancelled after ${progressState.value.currentBatch} of ${progressState.value.totalBatches} batches were downloaded.\n\nYou may have partial data in the downloaded files.`;
      }
      return 'Export was cancelled. No files were downloaded.';
    }

    if (exportPhase.value === EXPORT_PHASE.SUCCESS) {
      if (exportData.value.exportWasBatched) {
        return `Users from ${orgName} have been exported successfully in ${exportData.value.exportBatchCount} separate CSV files!`;
      }
      return `Users from ${orgName} have been exported successfully!`;
    }

    if (exportPhase.value === EXPORT_PHASE.FAILED) {
      return exportError.value || 'An unknown error occurred during export.';
    }

    // In progress messages
    if (exportPhase.value === EXPORT_PHASE.IN_PROGRESS) {
      if (progressState.value.totalBatches > 1) {
        return `Exporting batch ${progressState.value.currentBatch} of ${progressState.value.totalBatches}...\n\nPlease wait while your files are being prepared.`;
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
   * Modal severity based on current export phase.
   */
  const exportModalSeverity = computed(() => {
    switch (exportPhase.value) {
      case EXPORT_PHASE.CANCELLED:
        return 'warn';
      case EXPORT_PHASE.SUCCESS:
        return 'success';
      case EXPORT_PHASE.FAILED:
        return 'error';
      case EXPORT_PHASE.IN_PROGRESS:
        return 'info';
      case EXPORT_PHASE.IDLE:
        if (
          exportWarningLevel.value === WARNING_LEVELS.CRITICAL ||
          exportWarningLevel.value === WARNING_LEVELS.STRONG
        ) {
          return 'warn';
        }
        return 'info';
      default:
        return 'info';
    }
  });

  /**
   * Resets all modal state.
   */
  const resetModalState = () => {
    modalState.value = {
      showExportConfirmation: false,
      showNoUsersModal: false,
      noUsersOrgName: '',
    };
    exportPhase.value = EXPORT_PHASE.IDLE;
    exportError.value = '';
    exportWarningLevel.value = WARNING_LEVELS.NORMAL;
    exportData.value = {
      pendingExportData: null,
      exportWasBatched: false,
      exportBatchCount: 0,
    };
    progressState.value = {
      currentBatch: 0,
      totalBatches: 0,
    };
    exportingOrgId.value = null;
  };

  /**
   * Resets completion states only.
   */
  const resetCompletionStates = () => {
    exportPhase.value = EXPORT_PHASE.IDLE;
    exportError.value = '';
  };

  return {
    // Grouped state
    modalState,
    exportPhase,
    exportError,
    exportWarningLevel,
    exportData,
    progressState,
    exportingOrgId,

    // Computed
    isExportingOrgUsers,
    exportModalTitle,
    exportModalMessage,
    exportModalSeverity,

    // Functions
    resetModalState,
    resetCompletionStates,

    // Export constants for consumers
    EXPORT_PHASE,
  };
}
