import { useOrgExport } from './useOrgExport';
import { useExportModal } from './useExportModal';
import { WARNING_LEVELS, EXPORT_PHASE } from '../constants/exportConstants';

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
        modalState.modalState.value.noUsersOrgName = exportLogic.hasNameProperty(orgType)
          ? orgType.name
          : 'this organization';
        modalState.modalState.value.showNoUsersModal = true;
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
      modalState.exportData.value.pendingExportData = { orgType, userCount };
      modalState.exportWarningLevel.value = warningLevel;
      modalState.modalState.value.showExportConfirmation = true;
    } catch (error) {
      // Show error in modal
      modalState.exportPhase.value = EXPORT_PHASE.FAILED;
      modalState.exportError.value = error.message;
      modalState.modalState.value.showExportConfirmation = true;
    }
  };

  /**
   * Handles user confirmation to proceed with export.
   */
  const confirmExport = async () => {
    if (!modalState.exportData.value.pendingExportData) return;

    // Switch modal to progress mode
    modalState.exportPhase.value = EXPORT_PHASE.IN_PROGRESS;
    modalState.exportError.value = '';
    exportLogic.resetExportState();

    try {
      const { orgType, userCount } = modalState.exportData.value.pendingExportData;

      // Progress callback to update modal state in real-time
      const onProgress = (current, total) => {
        modalState.progressState.value.currentBatch = current;
        modalState.progressState.value.totalBatches = total;
      };

      const result = await exportLogic.performExport(orgType, userCount, onProgress);

      // Final sync of progress tracking
      modalState.progressState.value.currentBatch = exportLogic.currentBatch.value;
      modalState.progressState.value.totalBatches = exportLogic.totalBatches.value;

      if (result.cancelled) {
        modalState.exportPhase.value = EXPORT_PHASE.CANCELLED;
      } else if (result.success) {
        modalState.exportPhase.value = EXPORT_PHASE.SUCCESS;
        modalState.exportData.value.exportWasBatched = result.batched;
        modalState.exportData.value.exportBatchCount = result.batchCount;
      }
    } catch (error) {
      modalState.exportPhase.value = EXPORT_PHASE.FAILED;
      modalState.exportError.value = error.message;
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
    // State from modal (grouped)
    modalState: modalState.modalState,
    exportPhase: modalState.exportPhase,
    exportError: modalState.exportError,
    exportWarningLevel: modalState.exportWarningLevel,
    exportData: modalState.exportData,
    progressState: modalState.progressState,
    exportingOrgId: modalState.exportingOrgId,

    // Computed from modal
    isExportingOrgUsers: modalState.isExportingOrgUsers,
    exportModalTitle: modalState.exportModalTitle,
    exportModalMessage: modalState.exportModalMessage,
    exportModalSeverity: modalState.exportModalSeverity,

    // Constants
    EXPORT_PHASE: modalState.EXPORT_PHASE,

    // Functions
    exportOrgUsers,
    confirmExport,
    cancelExport,
    requestCancelExport,
  };
}
