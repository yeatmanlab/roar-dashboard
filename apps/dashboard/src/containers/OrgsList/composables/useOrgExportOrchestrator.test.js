import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { WARNING_LEVELS, EXPORT_PHASE } from '../constants/exportConstants';

// ---------------------------------------------------------------------------
// Mocks
//
// The orchestrator wires the pure export logic (useOrgExport) to the modal
// state machine (useExportModal). We mock both collaborators so these tests
// cover only the orchestrator's branching — phase transitions, the zero-user
// and warning-level forks, progress wiring, and cancel/reset delegation —
// without exercising real fetching, CSV serialisation, or PrimeVue state.
//   - useOrgExport     → the counting/export functions the orchestrator calls.
//   - useExportModal   → the ref-backed modal state the orchestrator mutates.
// ---------------------------------------------------------------------------

// --- useOrgExport mock -----------------------------------------------------
// Functions are vi.fn()s so each test sets the behavior it needs; the batch
// tracking refs back the orchestrator's "final sync of progress tracking".
const mockCountOrgUsers = vi.fn();
const mockGetExportWarningLevel = vi.fn();
const mockPerformExport = vi.fn();
const mockHasNameProperty = vi.fn();
const mockRequestCancel = vi.fn();
const mockResetExportState = vi.fn();
const exportCurrentBatch = ref(0);
const exportTotalBatches = ref(0);

vi.mock('./useOrgExport', () => ({
  useOrgExport: () => ({
    currentBatch: exportCurrentBatch,
    totalBatches: exportTotalBatches,
    hasNameProperty: mockHasNameProperty,
    getExportWarningLevel: mockGetExportWarningLevel,
    countOrgUsers: mockCountOrgUsers,
    performExport: mockPerformExport,
    requestCancel: mockRequestCancel,
    resetExportState: mockResetExportState,
  }),
}));

// --- useExportModal mock ---------------------------------------------------
// A faithful ref-backed stand-in: the orchestrator reads/writes these refs
// directly (e.g. modalState.exportPhase.value = ...), so the assertions read
// the post-condition off the same refs. Reset helpers are spies so delegation
// can be asserted.
let modalState;
let exportPhase;
let exportError;
let exportWarningLevel;
let exportData;
let progressState;
let exportingOrgId;
let mockResetModalState;
let mockResetCompletionStates;

vi.mock('./useExportModal', () => ({
  useExportModal: () => ({
    modalState,
    exportPhase,
    exportError,
    exportWarningLevel,
    exportData,
    progressState,
    exportingOrgId,
    // Computed/extra members the orchestrator re-exports but does not drive in
    // these tests; present so the returned shape matches the real composable.
    isExportingOrgUsers: ref(false),
    exportModalTitle: ref(''),
    exportModalMessage: ref(''),
    exportModalSeverity: ref('info'),
    resetModalState: mockResetModalState,
    resetCompletionStates: mockResetCompletionStates,
    EXPORT_PHASE,
  }),
}));

import { useOrgExportOrchestrator } from './useOrgExportOrchestrator';

beforeEach(() => {
  vi.clearAllMocks();

  // Fresh modal refs per test, mirroring useExportModal's initial state.
  modalState = ref({
    showExportConfirmation: false,
    showNoUsersModal: false,
    noUsersOrgName: '',
  });
  exportPhase = ref(EXPORT_PHASE.IDLE);
  exportError = ref('');
  exportWarningLevel = ref(WARNING_LEVELS.NORMAL);
  exportData = ref({
    pendingExportData: null,
    exportWasBatched: false,
    exportBatchCount: 0,
  });
  progressState = ref({ currentBatch: 0, totalBatches: 0 });
  exportingOrgId = ref(null);
  mockResetModalState = vi.fn();
  mockResetCompletionStates = vi.fn();

  exportCurrentBatch.value = 0;
  exportTotalBatches.value = 0;

  // Sensible default: hasNameProperty true so the no-users branch uses the name.
  mockHasNameProperty.mockReturnValue(true);
});

const ORG = { id: 'org-1', name: 'Test Org' };

describe('useOrgExportOrchestrator', () => {
  describe('exportOrgUsers', () => {
    it('no-ops when called without an org type', async () => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));

      await exportOrgUsers(undefined);

      expect(mockCountOrgUsers).not.toHaveBeenCalled();
      expect(exportingOrgId.value).toBe(null);
    });

    it('shows the no-users modal (with the org name) and clears the spinner when the count is 0', async () => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));
      mockCountOrgUsers.mockResolvedValue(0);

      await exportOrgUsers(ORG);

      expect(modalState.value.showNoUsersModal).toBe(true);
      expect(modalState.value.noUsersOrgName).toBe('Test Org');
      expect(exportingOrgId.value).toBe(null);
      // Zero users never reaches a real export.
      expect(mockPerformExport).not.toHaveBeenCalled();
    });

    it('falls back to a generic org label in the no-users modal when the org has no name', async () => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));
      mockCountOrgUsers.mockResolvedValue(0);
      mockHasNameProperty.mockReturnValue(false);

      await exportOrgUsers({ id: 'org-1' });

      expect(modalState.value.noUsersOrgName).toBe('this organization');
    });

    it('exports immediately (no confirmation) when the warning level is NONE', async () => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));
      mockCountOrgUsers.mockResolvedValue(5000);
      mockGetExportWarningLevel.mockReturnValue(WARNING_LEVELS.NONE);
      mockPerformExport.mockResolvedValue({ success: true, batched: false, batchCount: 1 });

      await exportOrgUsers(ORG);

      expect(mockPerformExport).toHaveBeenCalledWith(ORG, 5000);
      expect(modalState.value.showExportConfirmation).toBe(false);
      expect(exportingOrgId.value).toBe(null);
    });

    it.each([
      ['NORMAL', WARNING_LEVELS.NORMAL, 15000],
      ['STRONG', WARNING_LEVELS.STRONG, 30000],
      ['CRITICAL', WARNING_LEVELS.CRITICAL, 60000],
    ])('shows the confirmation modal for a %s warning level instead of exporting', async (_label, level, count) => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));
      mockCountOrgUsers.mockResolvedValue(count);
      mockGetExportWarningLevel.mockReturnValue(level);

      await exportOrgUsers(ORG);

      // Confirmation is staged; the actual export is deferred to confirmExport.
      expect(mockResetCompletionStates).toHaveBeenCalled();
      expect(exportData.value.pendingExportData).toEqual({ orgType: ORG, userCount: count });
      expect(exportWarningLevel.value).toBe(level);
      expect(modalState.value.showExportConfirmation).toBe(true);
      expect(mockPerformExport).not.toHaveBeenCalled();
    });

    it('moves to the FAILED phase and surfaces the message when counting throws', async () => {
      const { exportOrgUsers } = useOrgExportOrchestrator(ref('districts'));
      mockCountOrgUsers.mockRejectedValue(new Error('count failed'));

      await exportOrgUsers(ORG);

      expect(exportPhase.value).toBe(EXPORT_PHASE.FAILED);
      expect(exportError.value).toBe('count failed');
      expect(modalState.value.showExportConfirmation).toBe(true);
    });
  });

  describe('confirmExport', () => {
    it('no-ops when there is no pending export data', async () => {
      const { confirmExport } = useOrgExportOrchestrator(ref('districts'));
      exportData.value.pendingExportData = null;

      await confirmExport();

      expect(mockPerformExport).not.toHaveBeenCalled();
      expect(mockResetExportState).not.toHaveBeenCalled();
    });

    it('runs the export and transitions to SUCCESS, syncing batch info', async () => {
      const { confirmExport } = useOrgExportOrchestrator(ref('districts'));
      exportData.value.pendingExportData = { orgType: ORG, userCount: 60000 };
      exportCurrentBatch.value = 2;
      exportTotalBatches.value = 2;
      mockPerformExport.mockResolvedValue({ success: true, batched: true, batchCount: 2 });

      await confirmExport();

      // Enters progress mode and clears prior state before running.
      expect(mockResetExportState).toHaveBeenCalled();
      expect(mockPerformExport).toHaveBeenCalledTimes(1);
      // Success phase + batch metadata propagated to the modal.
      expect(exportPhase.value).toBe(EXPORT_PHASE.SUCCESS);
      expect(exportData.value.exportWasBatched).toBe(true);
      expect(exportData.value.exportBatchCount).toBe(2);
      // Final progress sync mirrors the export logic's tracking refs.
      expect(progressState.value.currentBatch).toBe(2);
      expect(progressState.value.totalBatches).toBe(2);
    });

    it('forwards progress updates from performExport into the modal progress state', async () => {
      const { confirmExport } = useOrgExportOrchestrator(ref('districts'));
      exportData.value.pendingExportData = { orgType: ORG, userCount: 60000 };
      // Capture the live progress state at the moment the orchestrator's onProgress
      // callback fires — the post-export sync (lines 85-86 of the orchestrator) then
      // overwrites progressState from the export logic's final batch refs, so asserting
      // after confirmExport() would test the sync, not the onProgress forwarding.
      let progressDuringExport = null;
      mockPerformExport.mockImplementation(async (_orgType, _count, onProgress) => {
        onProgress(1, 3);
        progressDuringExport = {
          currentBatch: progressState.value.currentBatch,
          totalBatches: progressState.value.totalBatches,
        };
        return { success: true, batched: true, batchCount: 3 };
      });

      await confirmExport();

      // The onProgress callback forwarded the update into the modal progress state live.
      expect(progressDuringExport).toEqual({ currentBatch: 1, totalBatches: 3 });
      expect(exportPhase.value).toBe(EXPORT_PHASE.SUCCESS);
    });

    it('transitions to CANCELLED when the export reports cancellation', async () => {
      const { confirmExport } = useOrgExportOrchestrator(ref('districts'));
      exportData.value.pendingExportData = { orgType: ORG, userCount: 60000 };
      mockPerformExport.mockResolvedValue({ cancelled: true, batchesCompleted: 0 });

      await confirmExport();

      expect(exportPhase.value).toBe(EXPORT_PHASE.CANCELLED);
      // A cancelled export is not a success: batch metadata stays at its default.
      expect(exportData.value.exportWasBatched).toBe(false);
    });

    it('transitions to FAILED and records the error message when performExport throws', async () => {
      const { confirmExport } = useOrgExportOrchestrator(ref('districts'));
      exportData.value.pendingExportData = { orgType: ORG, userCount: 60000 };
      mockPerformExport.mockRejectedValue(new Error('export blew up'));

      await confirmExport();

      expect(exportPhase.value).toBe(EXPORT_PHASE.FAILED);
      expect(exportError.value).toBe('export blew up');
    });
  });

  describe('cancel delegation', () => {
    it('requestCancelExport delegates to the export logic requestCancel', () => {
      const { requestCancelExport } = useOrgExportOrchestrator(ref('districts'));

      requestCancelExport();

      expect(mockRequestCancel).toHaveBeenCalledTimes(1);
    });

    it('cancelExport resets both the modal state and the export state', () => {
      const { cancelExport } = useOrgExportOrchestrator(ref('districts'));

      cancelExport();

      expect(mockResetModalState).toHaveBeenCalledTimes(1);
      expect(mockResetExportState).toHaveBeenCalledTimes(1);
    });
  });
});
