import { useOrgExport } from './useOrgExport';
import { useExportModal } from './useExportModal';
import { WARNING_LEVELS } from '../constants/exportConstants';

/**
 * Orchestrator composable that connects export logic with modal state
 *
 * @param {Ref<string>} activeOrgType - The active organization type
 * @param {Ref<object>} orderBy - The ordering configuration for queries
 * @returns {object} Combined export and modal functionality
 */
export function useOrgExportOrchestrator(activeOrgType, orderBy) {
  // Get export logic
  const exportLogic = useOrgExport(activeOrgType, orderBy);

  // Get modal state
  const modalState = useExportModal();

  /**
   * Initiates the export process with tiered warnings based on user count.
   */
  const exportOrgUsers = async (orgType) => {
    if (!orgType) return;

    // Set exporting org ID for button spinner
    modalState.exportingOrgId.value = orgType.id;

    try {
      // Count the users
      const userCount = await exportLogic.countOrgUsers(orgType);

      if (userCount === 0) {
        modalState.noUsersOrgName.value = exportLogic.hasNameProperty(orgType) ? orgType.name : 'this organization';
        modalState.showNoUsersModal.value = true;
        modalState.exportingOrgId.value = null;
        return;
      }

      const warningLevel = exportLogic.getExportWarningLevel(userCount);

      // If no warning needed, export immediately
      if (warningLevel === WARNING_LEVELS.NONE) {
        await exportLogic.performExport(orgType, userCount);
        modalState.exportingOrgId.value = null;
        return;
      }

      // Show confirmation modal for larger exports
      modalState.resetCompletionStates();
      modalState.pendingExportData.value = { orgType, userCount };
      modalState.exportWarningLevel.value = warningLevel;
      modalState.showExportConfirmation.value = true;
    } catch (error) {
      // Show error in modal
      modalState.exportComplete.value = true;
      modalState.exportSuccess.value = false;
      modalState.exportError.value = error.message;
      modalState.showExportConfirmation.value = true;
    }
  };

  /**
   * Handles user confirmation to proceed with export.
   */
  const confirmExport = async () => {
    if (!modalState.pendingExportData.value) return;

    // Switch modal to progress mode
    modalState.exportInProgress.value = true;
    modalState.exportComplete.value = false;
    modalState.exportSuccess.value = false;
    modalState.exportCancelled.value = false;
    modalState.exportError.value = '';
    exportLogic.resetExportState();

    try {
      const { orgType, userCount } = modalState.pendingExportData.value;

      // Progress callback to update modal state in real-time
      const onProgress = (current, total) => {
        modalState.currentBatch.value = current;
        modalState.totalBatches.value = total;
      };

      const result = await exportLogic.performExport(orgType, userCount, onProgress);

      // Final sync of progress tracking
      modalState.currentBatch.value = exportLogic.currentBatch.value;
      modalState.totalBatches.value = exportLogic.totalBatches.value;

      if (result.cancelled) {
        modalState.exportComplete.value = true;
        modalState.exportSuccess.value = false;
        modalState.exportCancelled.value = true;
      } else if (result.success) {
        modalState.exportComplete.value = true;
        modalState.exportSuccess.value = true;
        modalState.exportWasBatched.value = result.batched;
        modalState.exportBatchCount.value = result.batchCount;
      }
    } catch (error) {
      modalState.exportComplete.value = true;
      modalState.exportSuccess.value = false;
      modalState.exportCancelled.value = false;
      modalState.exportError.value = error.message;
    } finally {
      modalState.exportInProgress.value = false;
    }
  };

  /**
   * Handles user request to cancel ongoing export.
   */
  const requestCancelExport = () => {
    exportLogic.requestCancel();
  };

  /**
   * Handles user cancellation of export or closing after completion.
   */
  const cancelExport = () => {
    modalState.resetModalState();
    exportLogic.resetExportState();
  };

  return {
    // State from modal
    showExportConfirmation: modalState.showExportConfirmation,
    exportInProgress: modalState.exportInProgress,
    exportComplete: modalState.exportComplete,
    exportSuccess: modalState.exportSuccess,
    exportCancelled: modalState.exportCancelled,
    exportWarningLevel: modalState.exportWarningLevel,
    exportingOrgId: modalState.exportingOrgId,
    showNoUsersModal: modalState.showNoUsersModal,
    noUsersOrgName: modalState.noUsersOrgName,
    currentBatch: modalState.currentBatch,
    totalBatches: modalState.totalBatches,

    // Computed from modal
    isExportingOrgUsers: modalState.isExportingOrgUsers,
    exportModalTitle: modalState.exportModalTitle,
    exportModalMessage: modalState.exportModalMessage,
    exportModalSeverity: modalState.exportModalSeverity,

    // Functions
    exportOrgUsers,
    confirmExport,
    cancelExport,
    requestCancelExport,
  };
}
