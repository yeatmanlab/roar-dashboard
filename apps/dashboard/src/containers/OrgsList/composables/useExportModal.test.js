import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useExportModal } from './useExportModal';
import { WARNING_LEVELS } from './exportConstants';

describe('useExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const {
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
      } = useExportModal();

      expect(showExportConfirmation.value).toBe(false);
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
      expect(exportWarningLevel.value).toBe(WARNING_LEVELS.NORMAL);
      expect(exportingOrgId.value).toBe(null);
      expect(showNoUsersModal.value).toBe(false);
      expect(noUsersOrgName.value).toBe('');
      expect(currentBatch.value).toBe(0);
      expect(totalBatches.value).toBe(0);
    });
  });

  describe('isExportingOrgUsers', () => {
    it('should return true when exportingOrgId is set', () => {
      const { isExportingOrgUsers, exportingOrgId } = useExportModal();

      expect(isExportingOrgUsers.value).toBe(false);

      exportingOrgId.value = 'org-123';
      expect(isExportingOrgUsers.value).toBe(true);

      exportingOrgId.value = null;
      expect(isExportingOrgUsers.value).toBe(false);
    });
  });

  describe('exportModalTitle', () => {
    it('should return correct title for each state', () => {
      const { exportModalTitle, exportComplete, exportCancelled, exportSuccess, exportInProgress, exportWarningLevel } =
        useExportModal();

      // Cancelled state
      exportComplete.value = true;
      exportCancelled.value = true;
      expect(exportModalTitle.value).toBe('Export Cancelled');

      // Success state
      exportCancelled.value = false;
      exportSuccess.value = true;
      expect(exportModalTitle.value).toBe('Export Successful');

      // Failed state
      exportSuccess.value = false;
      expect(exportModalTitle.value).toBe('Export Failed');

      // In progress state
      exportComplete.value = false;
      exportInProgress.value = true;
      expect(exportModalTitle.value).toBe('Exporting...');

      // Critical warning
      exportInProgress.value = false;
      exportWarningLevel.value = WARNING_LEVELS.CRITICAL;
      expect(exportModalTitle.value).toBe('Large Export Warning');

      // Strong warning
      exportWarningLevel.value = WARNING_LEVELS.STRONG;
      expect(exportModalTitle.value).toBe('Export Warning');

      // Default
      exportWarningLevel.value = WARNING_LEVELS.NORMAL;
      expect(exportModalTitle.value).toBe('Confirm Export');
    });
  });

  describe('exportModalSeverity', () => {
    it('should return correct severity for each state', () => {
      const {
        exportModalSeverity,
        exportComplete,
        exportCancelled,
        exportSuccess,
        exportInProgress,
        exportWarningLevel,
      } = useExportModal();

      // Cancelled
      exportComplete.value = true;
      exportCancelled.value = true;
      expect(exportModalSeverity.value).toBe('warn');

      // Success
      exportCancelled.value = false;
      exportSuccess.value = true;
      expect(exportModalSeverity.value).toBe('success');

      // Error
      exportSuccess.value = false;
      expect(exportModalSeverity.value).toBe('error');

      // In progress
      exportComplete.value = false;
      exportInProgress.value = true;
      expect(exportModalSeverity.value).toBe('info');

      // Critical warning
      exportInProgress.value = false;
      exportWarningLevel.value = WARNING_LEVELS.CRITICAL;
      expect(exportModalSeverity.value).toBe('warn');

      // Normal
      exportWarningLevel.value = WARNING_LEVELS.NORMAL;
      expect(exportModalSeverity.value).toBe('info');
    });
  });

  describe('resetModalState', () => {
    it('should reset all state to defaults', () => {
      const {
        resetModalState,
        showExportConfirmation,
        exportInProgress,
        exportComplete,
        exportSuccess,
        exportCancelled,
        exportWarningLevel,
        exportingOrgId,
        currentBatch,
        totalBatches,
      } = useExportModal();

      // Set some state
      showExportConfirmation.value = true;
      exportInProgress.value = true;
      exportComplete.value = true;
      exportSuccess.value = true;
      currentBatch.value = 3;
      totalBatches.value = 5;
      exportingOrgId.value = 'org-123';

      resetModalState();

      expect(showExportConfirmation.value).toBe(false);
      expect(exportWarningLevel.value).toBe(WARNING_LEVELS.NORMAL);
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
      expect(exportingOrgId.value).toBe(null);
      expect(currentBatch.value).toBe(0);
      expect(totalBatches.value).toBe(0);
    });
  });

  describe('resetCompletionStates', () => {
    it('should reset only completion states', () => {
      const {
        resetCompletionStates,
        exportInProgress,
        exportComplete,
        exportSuccess,
        exportCancelled,
        exportError,
        showExportConfirmation,
      } = useExportModal();

      // Set some state
      showExportConfirmation.value = true;
      exportInProgress.value = true;
      exportComplete.value = true;
      exportSuccess.value = true;
      exportCancelled.value = true;
      exportError.value = 'Some error';

      resetCompletionStates();

      // Completion states should be reset
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
      expect(exportError.value).toBe('');

      // Other state should remain
      expect(showExportConfirmation.value).toBe(true);
    });
  });
});
