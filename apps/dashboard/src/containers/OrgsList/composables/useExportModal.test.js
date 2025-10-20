import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useExportModal } from './useExportModal';
import { WARNING_LEVELS, EXPORT_PHASE, MODAL_SEVERITIES } from '../constants/exportConstants';

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
      const { modalState, exportPhase, exportWarningLevel, exportData, progressState, exportingOrgId } =
        useExportModal();

      expect(modalState.value.showExportConfirmation).toBe(false);
      expect(modalState.value.showNoUsersModal).toBe(false);
      expect(modalState.value.noUsersOrgName).toBe('');
      expect(exportPhase.value).toBe(EXPORT_PHASE.IDLE);
      expect(exportWarningLevel.value).toBe(WARNING_LEVELS.NORMAL);
      expect(exportData.value.pendingExportData).toBe(null);
      expect(exportData.value.exportWasBatched).toBe(false);
      expect(exportData.value.exportBatchCount).toBe(0);
      expect(progressState.value.currentBatch).toBe(0);
      expect(progressState.value.totalBatches).toBe(0);
      expect(exportingOrgId.value).toBe(null);
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
    it('should return correct title for each export phase', () => {
      const { exportModalTitle, exportPhase, exportWarningLevel } = useExportModal();

      // Cancelled phase
      exportPhase.value = EXPORT_PHASE.CANCELLED;
      expect(exportModalTitle.value).toBe('Export Cancelled');

      // Success phase
      exportPhase.value = EXPORT_PHASE.SUCCESS;
      expect(exportModalTitle.value).toBe('Export Successful');

      // Failed phase
      exportPhase.value = EXPORT_PHASE.FAILED;
      expect(exportModalTitle.value).toBe('Export Failed');

      // In progress phase
      exportPhase.value = EXPORT_PHASE.IN_PROGRESS;
      expect(exportModalTitle.value).toBe('Exporting...');

      // Idle with critical warning
      exportPhase.value = EXPORT_PHASE.IDLE;
      exportWarningLevel.value = WARNING_LEVELS.CRITICAL;
      expect(exportModalTitle.value).toBe('Large Export Warning');

      // Idle with strong warning
      exportWarningLevel.value = WARNING_LEVELS.STRONG;
      expect(exportModalTitle.value).toBe('Export Warning');

      // Idle with normal warning
      exportWarningLevel.value = WARNING_LEVELS.NORMAL;
      expect(exportModalTitle.value).toBe('Confirm Export');
    });
  });

  describe('exportModalSeverity', () => {
    it('should return correct severity for each export phase', () => {
      const { exportModalSeverity, exportPhase, exportWarningLevel } = useExportModal();

      // Cancelled
      exportPhase.value = EXPORT_PHASE.CANCELLED;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.WARN);

      // Success
      exportPhase.value = EXPORT_PHASE.SUCCESS;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.SUCCESS);

      // Failed
      exportPhase.value = EXPORT_PHASE.FAILED;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.ERROR);

      // In progress
      exportPhase.value = EXPORT_PHASE.IN_PROGRESS;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.INFO);

      // Idle with critical warning
      exportPhase.value = EXPORT_PHASE.IDLE;
      exportWarningLevel.value = WARNING_LEVELS.CRITICAL;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.WARN);

      // Idle with normal warning
      exportWarningLevel.value = WARNING_LEVELS.NORMAL;
      expect(exportModalSeverity.value).toBe(MODAL_SEVERITIES.INFO);
    });
  });

  describe('resetModalState', () => {
    it('should reset all state to defaults', () => {
      const {
        resetModalState,
        modalState,
        exportPhase,
        exportWarningLevel,
        exportData,
        progressState,
        exportingOrgId,
      } = useExportModal();

      // Set some state
      modalState.value.showExportConfirmation = true;
      exportPhase.value = EXPORT_PHASE.SUCCESS;
      exportData.value.exportBatchCount = 3;
      progressState.value.currentBatch = 2;
      progressState.value.totalBatches = 5;
      exportingOrgId.value = 'org-123';

      resetModalState();

      expect(modalState.value.showExportConfirmation).toBe(false);
      expect(modalState.value.showNoUsersModal).toBe(false);
      expect(modalState.value.noUsersOrgName).toBe('');
      expect(exportPhase.value).toBe(EXPORT_PHASE.IDLE);
      expect(exportWarningLevel.value).toBe(WARNING_LEVELS.NORMAL);
      expect(exportData.value.pendingExportData).toBe(null);
      expect(exportData.value.exportWasBatched).toBe(false);
      expect(exportData.value.exportBatchCount).toBe(0);
      expect(progressState.value.currentBatch).toBe(0);
      expect(progressState.value.totalBatches).toBe(0);
      expect(exportingOrgId.value).toBe(null);
    });
  });

  describe('resetCompletionStates', () => {
    it('should reset only completion states', () => {
      const { resetCompletionStates, exportPhase, exportError, modalState, exportData } = useExportModal();

      // Set some state
      modalState.value.showExportConfirmation = true;
      exportPhase.value = EXPORT_PHASE.SUCCESS;
      exportError.value = 'Some error';
      exportData.value.pendingExportData = { orgType: {}, userCount: 100 };

      resetCompletionStates();

      // Completion states should be reset
      expect(exportPhase.value).toBe(EXPORT_PHASE.IDLE);
      expect(exportError.value).toBe('');

      // Other state should remain
      expect(modalState.value.showExportConfirmation).toBe(true);
      expect(exportData.value.pendingExportData).toEqual({ orgType: {}, userCount: 100 });
    });
  });

  describe('EXPORT_PHASE constant', () => {
    it('should export EXPORT_PHASE constant', () => {
      const { EXPORT_PHASE: exportedPhase } = useExportModal();

      expect(exportedPhase).toBeDefined();
      expect(exportedPhase.IDLE).toBe('idle');
      expect(exportedPhase.IN_PROGRESS).toBe('inProgress');
      expect(exportedPhase.SUCCESS).toBe('success');
      expect(exportedPhase.FAILED).toBe('failed');
      expect(exportedPhase.CANCELLED).toBe('cancelled');
    });
  });
});
