import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useOrgExport } from './useOrgExport';
import * as usersQuery from '@/helpers/query/users';
import * as queryUtils from '@/helpers/query/utils';
import * as Sentry from '@sentry/vue';
import { WARNING_LEVELS } from '../constants/exportConstants';

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
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('getExportWarningLevel', () => {
    it('should return correct warning levels based on user count', async () => {
      const { getExportWarningLevel } = useOrgExport(activeOrgType, orderBy);

      expect(getExportWarningLevel(5000)).toBe(WARNING_LEVELS.NONE);
      expect(getExportWarningLevel(15000)).toBe(WARNING_LEVELS.NORMAL);
      expect(getExportWarningLevel(30000)).toBe(WARNING_LEVELS.STRONG);
      expect(getExportWarningLevel(60000)).toBe(WARNING_LEVELS.CRITICAL);
    });
  });

  describe('countOrgUsers', () => {
    it('should count users for an organization', async () => {
      const { countOrgUsers } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'countUsersByOrg').mockResolvedValue(100);

      const orgType = { id: 'org-1', name: 'Test Org' };
      const count = await countOrgUsers(orgType);

      expect(count).toBe(100);
      expect(usersQuery.countUsersByOrg).toHaveBeenCalledWith('districts', 'org-1', orderBy);
    });

    it('should handle errors and capture to Sentry', async () => {
      const { countOrgUsers } = useOrgExport(activeOrgType, orderBy);

      const error = new Error('Count failed');
      vi.spyOn(usersQuery, 'countUsersByOrg').mockRejectedValue(error);
      vi.spyOn(Sentry, 'captureException').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };

      await expect(countOrgUsers(orgType)).rejects.toThrow('Count failed');
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('performExport', () => {
    it('should perform single export for small datasets', async () => {
      const { performExport } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([
        { username: 'user1', email: 'user1@test.com', name: { first: 'John', last: 'Doe' } },
      ]);
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      const result = await performExport(orgType, 5000);

      expect(result).toEqual({ success: true, batched: false, batchCount: 1 });
      expect(usersQuery.fetchUsersByOrg).toHaveBeenCalledTimes(1);
      expect(queryUtils.exportCsv).toHaveBeenCalledWith(expect.anything(), 'test-org-users-export.csv');
    });

    it('should perform batched export for large datasets', async () => {
      const { performExport } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockResolvedValue([{ username: 'user1', email: 'user1@test.com' }]);
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };
      const result = await performExport(orgType, 60000);

      expect(result).toEqual({ success: true, batched: true, batchCount: 6 });
      expect(usersQuery.fetchUsersByOrg).toHaveBeenCalledTimes(6);
      expect(queryUtils.exportCsv).toHaveBeenCalledWith(expect.anything(), 'test-org-users-export-part-1-of-6.csv');
    });

    it('should handle cancellation during export', async () => {
      const { performExport, requestCancel } = useOrgExport(activeOrgType, orderBy);

      vi.spyOn(usersQuery, 'fetchUsersByOrg').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [{ username: 'user1', email: 'user1@test.com' }];
      });
      vi.spyOn(queryUtils, 'exportCsv').mockImplementation(() => {});

      const orgType = { id: 'org-1', name: 'Test Org' };

      // Request cancellation immediately
      requestCancel();

      const result = await performExport(orgType, 60000);

      expect(result.cancelled).toBe(true);
    });
  });

  describe('hasNameProperty', () => {
    it('should correctly identify objects with name property', () => {
      const { hasNameProperty } = useOrgExport(activeOrgType, orderBy);

      expect(hasNameProperty({ name: 'Test' })).toBe(true);
      expect(hasNameProperty({ id: '123' })).toBe(false);
      expect(hasNameProperty(null)).toBeFalsy();
      expect(hasNameProperty(undefined)).toBeFalsy();
    });
  });
});
