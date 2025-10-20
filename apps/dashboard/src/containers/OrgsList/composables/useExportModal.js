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
      default:
        return 'Confirm Export';
    }
  });

  /**
   * Modal message based on current export phase.
   */
  const exportModalMessage = computed(() => {
    const userCount = pendingExportData.value?.userCount || 0;
    const formattedCount = userCount.toLocaleString();
    const orgName = pendingExportData.value?.orgType?.name || '';
  
    const isComplete = exportComplete.value;
    const isCancelled = exportCancelled.value;
    const isSuccess = exportSuccess.value;
    const isInProgress = exportInProgress.value;
  
    const total = totalBatches.value || 0;
    const current = currentBatch.value || 0;
  
    const wasBatched = exportWasBatched.value;
    const batchCount = exportBatchCount.value;
    const numBatches = Math.ceil(userCount / CSV_EXPORT_BATCH_SIZE);
    const errorMsg = exportError.value;
  
    const warningLevel = exportWarningLevel.value;
  
    const cancelledMessage = () => {
      if (total > 1 && current > 0) {
        return `Export was cancelled after ${current} of ${total} batches were downloaded.\n\nYou may have partial data in the downloaded files.`;
      }
      return `Export was cancelled. No files were downloaded.`;
    };
  
    const successMessage = () => {
      if (wasBatched) {
        return `Users from ${orgName} have been exported successfully in ${batchCount} separate CSV files!`;
      }
      return `Users from ${orgName} have been exported successfully!`;
    };
  
    const progressMessage = () => {
      if (total > 1) {
        return `Exporting batch ${current} of ${total}...\n\nPlease wait while your files are being prepared.`;
      }
      return `Exporting ${formattedCount} users...\n\nPlease wait while your file is being prepared.`;
    };
  
    const warningMessage = () => {
      if (warningLevel === 'critical') {
        return `
          This export contains ${formattedCount} users and will be split into ${numBatches} separate CSV files (${CSV_EXPORT_BATCH_SIZE.toLocaleString()} users each) to prevent your browser from becoming unresponsive.
    
          The files will download one at a time and will be named:
          • part-1-of-${numBatches}.csv
          • part-2-of-${numBatches}.csv
          • etc.
          
          This may take several minutes to complete. If you prefer smaller exports, consider filtering by a smaller organization type (district, school, or class).
        `;
      }
  
      if (warningLevel === 'strong') {
        return `
          This export contains ${formattedCount} users and may take 1-3 minutes to complete.
  
          Consider filtering by a smaller organization if you need faster results.
        `;
      }
  
      return `This export contains ${formattedCount} users and may take 30-60 seconds to complete.`;
    };
  
    if (isComplete) {
      if (isCancelled) return cancelledMessage();
      if (isSuccess) return successMessage();
      return errorMsg || 'An unknown error occurred during export.';
    }
  
    if (isInProgress) return progressMessage();
  
    return warningMessage();
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
