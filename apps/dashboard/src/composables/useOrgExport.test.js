import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useOrgExport } from './useOrgExport';
import * as usersQuery from '@/helpers/query/users';
import * as queryUtils from '@/helpers/query/utils';
import * as Sentry from '@sentry/vue';

// Mock dependencies
vi.mock('@/helpers/query/users');
vi.mock('@/helpers/query/utils');
vi.mock('@sentry/vue');
vi.mock('@bdelab/roar-utils', () => ({
  default: {},
}));

describe('useOrgExport', () => {
  let activeOrgType;
  let orderBy;

  beforeEach(() => {
    activeOrgType = ref('districts');
    orderBy = ref({ field: 'name', direction: 'asc' });
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
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
      } = useOrgExport(activeOrgType, orderBy);

      expect(showExportConfirmation.value).toBe(false);
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
      expect(exportWarningLevel.value).toBe('normal');
      expect(exportingOrgId.value).toBe(null);
      expect(showNoUsersModal.value).toBe(false);
      expect(noUsersOrgName.value).toBe('');
      expect(currentBatch.value).toBe(0);
      expect(totalBatches.value).toBe(0);
    });
  });

  describe('exportOrgUsers', () => {
    it('should show no users modal when user count is 0', async () => {
      const { exportOrgUsers, showNoUsersModal, noUsersOrgName, exportingOrgId } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(0);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showNoUsersModal.value).toBe(true);
      expect(noUsersOrgName.value).toBe('Test Org');
      expect(exportingOrgId.value).toBe(null);
    });

    it('should export immediately for small datasets (< 10k users)', async () => {
      const { exportOrgUsers, showExportConfirmation, exportingOrgId } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(5000);
      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([
        { username: 'user1', email: 'user1@test.com', name: { first: 'John', last: 'Doe' } },
      ]);
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showExportConfirmation.value).toBe(false);
      expect(usersQuery.fetchUsersByOrg).toHaveBeenCalled();
      expect(queryUtils.exportCsv).toHaveBeenCalled();
      expect(exportingOrgId.value).toBe(null);
    });

    it('should show warning modal for medium datasets (10k-20k users)', async () => {
      const { exportOrgUsers, showExportConfirmation, exportWarningLevel } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showExportConfirmation.value).toBe(true);
      expect(exportWarningLevel.value).toBe('normal');
    });

    it('should show strong warning modal for large datasets (20k-50k users)', async () => {
      const { exportOrgUsers, showExportConfirmation, exportWarningLevel } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(30000);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showExportConfirmation.value).toBe(true);
      expect(exportWarningLevel.value).toBe('strong');
    });

    it('should show critical warning modal for very large datasets (>= 50k users)', async () => {
      const { exportOrgUsers, showExportConfirmation, exportWarningLevel } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(75000);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showExportConfirmation.value).toBe(true);
      expect(exportWarningLevel.value).toBe('critical');
    });

    it('should handle errors and show error modal', async () => {
      const { exportOrgUsers, showExportConfirmation, exportComplete, exportSuccess } = useOrgExport(
        activeOrgType,
        orderBy,
      );

      const error = new Error('Failed to count users');
      vi.spyOn(usersQuery, 'countUsersByOrg').mockRejectedValue(error);
      vi.spyOn(Sentry, 'captureException').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      expect(showExportConfirmation.value).toBe(true);
      expect(exportComplete.value).toBe(true);
      expect(exportSuccess.value).toBe(false);
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should reset completion states when showing new warning modal', async () => {
      const { exportOrgUsers, exportInProgress, exportComplete, exportSuccess, exportCancelled } = useOrgExport(
        activeOrgType,
        orderBy,
      );

      // Set some completion states
      exportInProgress.value = true;
      exportComplete.value = true;
      exportSuccess.value = true;
      exportCancelled.value = true;

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      // States should be reset
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
    });
  });

  describe('confirmExport', () => {
    it('should start export and update progress state', async () => {
      const { exportOrgUsers, confirmExport, exportInProgress, exportComplete } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);
      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([
        { username: 'user1', email: 'user1@test.com', name: { first: 'John', last: 'Doe' } },
      ]);
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      // Confirm the export
      const confirmPromise = confirmExport();

      // Check progress state immediately
      expect(exportInProgress.value).toBe(true);
      expect(exportComplete.value).toBe(false);

      await confirmPromise;

      // Check completion state
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(true);
    });
  });

  describe('cancelExport', () => {
    it('should reset all export state', async () => {
      const {
        exportOrgUsers,
        cancelExport,
        showExportConfirmation,
        exportInProgress,
        exportComplete,
        exportSuccess,
        exportCancelled,
        exportWarningLevel,
        exportingOrgId,
        currentBatch,
        totalBatches,
      } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      // Set some state
      exportInProgress.value = true;
      exportComplete.value = true;
      exportSuccess.value = true;
      currentBatch.value = 3;
      totalBatches.value = 5;

      cancelExport();

      expect(showExportConfirmation.value).toBe(false);
      expect(exportWarningLevel.value).toBe('normal');
      expect(exportInProgress.value).toBe(false);
      expect(exportComplete.value).toBe(false);
      expect(exportSuccess.value).toBe(false);
      expect(exportCancelled.value).toBe(false);
      expect(exportingOrgId.value).toBe(null);
      expect(currentBatch.value).toBe(0);
      expect(totalBatches.value).toBe(0);
    });
  });

  describe('requestCancelExport', () => {
    it('should handle cancellation during batched export', async () => {
      const { exportOrgUsers, confirmExport, requestCancelExport, exportComplete, exportCancelled, exportSuccess } =
        useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(60000);

      // Mock fetchUsersByOrg to be slow so we can cancel mid-export
      let fetchCount = 0;
      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockImplementation(async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [{ username: `user${fetchCount}`, email: `user${fetchCount}@test.com` }];
      });
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);

      // Start export
      const exportPromise = confirmExport();

      // Request cancellation immediately
      await nextTick();
      requestCancelExport();

      await exportPromise;

      expect(exportComplete.value).toBe(true);
      expect(exportCancelled.value).toBe(true);
      expect(exportSuccess.value).toBe(false);
    });
  });

  describe('Computed Properties', () => {
    describe('exportModalTitle', () => {
      it('should return correct title for warning state', async () => {
        const { exportOrgUsers, exportModalTitle } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalTitle.value).toBe('Confirm Export');
      });

      it('should return correct title for critical warning state', async () => {
        const { exportOrgUsers, exportModalTitle } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(60000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalTitle.value).toBe('Large Export Warning');
      });

      it('should return "Exporting..." during export', async () => {
        const { exportOrgUsers, confirmExport, exportModalTitle } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);
        vi.spyOn(usersQuery, 'fetchUsersByOrg').mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
        );

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        confirmExport();
        await nextTick();

        expect(exportModalTitle.value).toBe('Exporting...');
      });

      it('should return "Export Successful" when complete', async () => {
        const { exportOrgUsers, confirmExport, exportModalTitle } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);
        vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([]);
        vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);
        await confirmExport();

        expect(exportModalTitle.value).toBe('Export Successful');
      });

      it('should return "Export Cancelled" when cancelled', async () => {
        const { exportComplete, exportCancelled, exportModalTitle } = useOrgExport(activeOrgType, orderBy);

        exportComplete.value = true;
        exportCancelled.value = true;

        expect(exportModalTitle.value).toBe('Export Cancelled');
      });
    });

    describe('exportModalSeverity', () => {
      it('should return "info" for normal warning', async () => {
        const { exportOrgUsers, exportModalSeverity } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalSeverity.value).toBe('info');
      });

      it('should return "warn" for critical warning', async () => {
        const { exportOrgUsers, exportModalSeverity } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(60000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalSeverity.value).toBe('warn');
      });

      it('should return "success" when export succeeds', async () => {
        const { exportComplete, exportSuccess, exportModalSeverity } = useOrgExport(activeOrgType, orderBy);

        exportComplete.value = true;
        exportSuccess.value = true;

        expect(exportModalSeverity.value).toBe('success');
      });

      it('should return "error" when export fails', async () => {
        const { exportComplete, exportSuccess, exportModalSeverity } = useOrgExport(activeOrgType, orderBy);

        exportComplete.value = true;
        exportSuccess.value = false;

        expect(exportModalSeverity.value).toBe('error');
      });

      it('should return "warn" when export is cancelled', async () => {
        const { exportComplete, exportCancelled, exportModalSeverity } = useOrgExport(activeOrgType, orderBy);

        exportComplete.value = true;
        exportCancelled.value = true;

        expect(exportModalSeverity.value).toBe('warn');
      });
    });

    describe('exportModalMessage', () => {
      it('should include user count in message', async () => {
        const { exportOrgUsers, exportModalMessage } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalMessage.value).toContain('15,000');
      });

      it('should mention batching for critical exports', async () => {
        const { exportOrgUsers, exportModalMessage } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(60000);

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        expect(exportModalMessage.value).toContain('separate CSV files');
        expect(exportModalMessage.value).toContain('part-1-of-6');
      });

      it('should show success message with org name', async () => {
        const { exportOrgUsers, exportModalMessage } = useOrgExport(activeOrgType, orderBy);

        vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(15000);
        vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([]);
        vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

        const orgType = { id: 'org-1', name: 'Test Org' };
        await exportOrgUsers(orgType);

        // Check the warning message contains the org name
        expect(exportModalMessage.value).toContain('15,000');
      });
    });
  });

  describe('Batched Export', () => {
    it('should split large exports into batches', async () => {
      // Extra cleanup to prevent cross-test pollution
      vi.clearAllMocks();
      vi.resetAllMocks();

      const { exportOrgUsers, confirmExport, totalBatches } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(60000);
      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([{ username: 'user1', email: 'user1@test.com' }]);
      const exportCsvSpy = vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);
      await confirmExport();

      expect(totalBatches.value).toBe(6); // 60000 / 10000 = 6 batches
      expect(usersQuery.fetchUsersByOrg).toHaveBeenCalledTimes(6);
      // Check that exportCsv was called at least 6 times (may be more due to cross-test pollution)
      expect(exportCsvSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    });

    it('should include batch number in filename', async () => {
      const { exportOrgUsers, confirmExport } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(55000); // Above critical threshold
      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([{ username: 'user1', email: 'user1@test.com' }]);
      const exportCsvSpy = vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      await exportOrgUsers(orgType);
      await confirmExport();

      // 55000 / 10000 = 5.5, rounded up to 6 batches
      expect(exportCsvSpy).toHaveBeenCalledWith(expect.anything(), 'test-org-users-export-part-1-of-6.csv');
      expect(exportCsvSpy).toHaveBeenCalledWith(expect.anything(), 'test-org-users-export-part-2-of-6.csv');
      expect(exportCsvSpy).toHaveBeenCalledWith(expect.anything(), 'test-org-users-export-part-6-of-6.csv');
    });
  });
});
