import { describe, it, expect, vi } from 'vitest';
import { useOrgTableColumns } from './useOrgTableColumns';
import { ORG_EXPORT_EVENTS } from '../constants/exportConstants';
import { ref } from 'vue';

describe('useOrgTableColumns', () => {
  const mockPermissions = {
    Users: { LIST: 'users:list' },
    Organizations: { UPDATE: 'organizations:update' },
  };

  describe('Base Columns', () => {
    it('should always include base columns', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const baseColumns = tableColumns.value.filter((col) => ['Name', 'Abbreviation'].includes(col.header));

      expect(baseColumns).toHaveLength(2);
      expect(baseColumns[0]).toMatchObject({
        field: 'name',
        header: 'Name',
        dataType: 'text',
        pinned: true,
        sort: true,
      });
      expect(baseColumns[1]).toMatchObject({
        field: 'abbreviation',
        header: 'Abbreviation',
        dataType: 'text',
        sort: true,
      });
    });

    it('should always include Export Users column', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const exportColumn = tableColumns.value.find((col) => col.header === 'Export Users');

      expect(exportColumn).toBeDefined();
      expect(exportColumn).toMatchObject({
        header: 'Export Users',
        buttonLabel: 'Export Users',
        button: true,
        eventName: ORG_EXPORT_EVENTS.EXPORT_ORG_USERS,
        buttonIcon: 'pi pi-download mr-2',
        sort: false,
      });
    });
  });

  describe('Dropped Columns', () => {
    // Address, Tags, Clever, and ClassLink were intentionally dropped during the
    // ts-rest backend migration — the backend org schemas don't expose them.
    it.each([['districts'], ['schools'], ['classes'], ['groups']])(
      'should never include Address, Tags, Clever, or ClassLink for %s',
      (orgType) => {
        const activeOrgType = ref(orgType);
        const isSuperAdmin = ref(true);
        const userCan = vi.fn(() => true);

        const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

        const headers = tableColumns.value.map((col) => col.header);
        expect(headers).not.toContain('Address');
        expect(headers).not.toContain('Tags');
        expect(headers).not.toContain('Clever');
        expect(headers).not.toContain('ClassLink');

        const fields = tableColumns.value.map((col) => col.field);
        expect(fields).not.toContain('address.formattedAddress');
        expect(fields).not.toContain('tags');
        expect(fields).not.toContain('clever');
        expect(fields).not.toContain('classlink');
      },
    );
  });

  describe('Organization Type Specific Columns', () => {
    it('should include MDR Number and NCES ID for districts', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      const ncesColumn = tableColumns.value.find((col) => col.header === 'NCES ID');

      expect(mdrColumn).toBeDefined();
      expect(ncesColumn).toBeDefined();
    });

    it('should include MDR Number and NCES ID for schools', () => {
      const activeOrgType = ref('schools');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      const ncesColumn = tableColumns.value.find((col) => col.header === 'NCES ID');

      expect(mdrColumn).toBeDefined();
      expect(ncesColumn).toBeDefined();
    });

    it('should NOT include MDR Number and NCES ID for classes', () => {
      const activeOrgType = ref('classes');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      const ncesColumn = tableColumns.value.find((col) => col.header === 'NCES ID');

      expect(mdrColumn).toBeUndefined();
      expect(ncesColumn).toBeUndefined();
    });

    it('should NOT include MDR Number and NCES ID for groups', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      const ncesColumn = tableColumns.value.find((col) => col.header === 'NCES ID');

      expect(mdrColumn).toBeUndefined();
      expect(ncesColumn).toBeUndefined();
    });
  });

  describe('Permission-Based Columns', () => {
    it('should include Users link when user has LIST permission', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn((permission) => permission === mockPermissions.Users.LIST);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const usersColumn = tableColumns.value.find((col) => col.header === 'Users');

      expect(usersColumn).toBeDefined();
      expect(usersColumn).toMatchObject({
        header: 'Users',
        link: true,
        routeName: 'ListUsers',
        routeTooltip: 'View users',
        routeLabel: 'Users',
        routeIcon: 'pi pi-user',
        sort: false,
      });
    });

    it('should NOT include Users link when user lacks LIST permission', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const usersColumn = tableColumns.value.find((col) => col.header === 'Users');

      expect(usersColumn).toBeUndefined();
    });

    it('should include Edit button when user has UPDATE permission', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn((permission) => permission === mockPermissions.Organizations.UPDATE);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const editColumn = tableColumns.value.find((col) => col.header === 'Edit');

      expect(editColumn).toBeDefined();
      expect(editColumn).toMatchObject({
        header: 'Edit',
        button: true,
        eventName: 'edit-button',
        buttonIcon: 'pi pi-pencil',
        sort: false,
      });
    });

    it('should NOT include Edit button when user lacks UPDATE permission', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const editColumn = tableColumns.value.find((col) => col.header === 'Edit');

      expect(editColumn).toBeUndefined();
    });
  });

  describe('SignUp Code Column', () => {
    // The SignUp Code (invitation code) action is gated to super admins AND the
    // Groups tab — invitation codes for districts/schools/classes were dropped
    // during the ts-rest backend migration (only groups expose the endpoint).
    it('should include the SignUp Code button for super admins on the groups tab', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(true);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');

      expect(inviteColumn).toBeDefined();
      expect(inviteColumn).toMatchObject({
        header: 'SignUp Code',
        buttonLabel: 'Invite Users',
        button: true,
        eventName: 'show-activation-code',
        buttonIcon: 'pi pi-send mr-2',
        sort: false,
      });
    });

    it.each([['districts'], ['schools'], ['classes']])(
      'should NOT include the SignUp Code button for super admins on the %s tab',
      (orgType) => {
        const activeOrgType = ref(orgType);
        const isSuperAdmin = ref(true);
        const userCan = vi.fn(() => false);

        const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

        const inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');

        expect(inviteColumn).toBeUndefined();
      },
    );

    it('should NOT include the SignUp Code button for non-super admins on the groups tab', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');

      expect(inviteColumn).toBeUndefined();
    });
  });

  describe('Reactivity', () => {
    it('should update columns when activeOrgType changes', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      // Initially no MDR/NCES columns for groups
      let mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      expect(mdrColumn).toBeUndefined();

      // Change to districts
      activeOrgType.value = 'districts';

      // Now should have MDR/NCES columns
      mdrColumn = tableColumns.value.find((col) => col.header === 'MDR Number');
      expect(mdrColumn).toBeDefined();
    });

    it('should update the SignUp Code column when isSuperAdmin changes on the groups tab', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      // Initially no SignUp Code button (not a super admin)
      let inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');
      expect(inviteColumn).toBeUndefined();

      // Become super admin
      isSuperAdmin.value = true;

      // Now should have the SignUp Code button (super admin + groups tab)
      inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');
      expect(inviteColumn).toBeDefined();
    });
  });

  describe('Column Order', () => {
    it('should maintain consistent column order', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(true);
      const userCan = vi.fn(() => true);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const headers = tableColumns.value.map((col) => col.header);

      // Base columns should come first
      expect(headers[0]).toBe('Name');
      expect(headers[1]).toBe('Abbreviation');

      // Export Users should be last
      expect(headers[headers.length - 1]).toBe('Export Users');
    });
  });

  describe('Full Configuration', () => {
    it('should include all possible columns for districts with super admin and all permissions', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(true);
      const userCan = vi.fn(() => true);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const headers = tableColumns.value.map((col) => col.header);

      // Districts get base columns, MDR/NCES, the permission-gated action
      // columns, and Export Users — but no SignUp Code (groups only).
      expect(headers).toEqual(['Name', 'Abbreviation', 'MDR Number', 'NCES ID', 'Users', 'Edit', 'Export Users']);
    });

    it('should include all possible columns for groups with super admin and all permissions', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(true);
      const userCan = vi.fn(() => true);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const headers = tableColumns.value.map((col) => col.header);

      // Groups have no MDR/NCES, but a super admin on the groups tab gets the
      // SignUp Code action.
      expect(headers).toEqual(['Name', 'Abbreviation', 'Users', 'Edit', 'SignUp Code', 'Export Users']);
    });

    it('should include minimal columns for groups with no permissions', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const headers = tableColumns.value.map((col) => col.header);

      // Should only have base columns + Export Users
      expect(headers).toEqual(['Name', 'Abbreviation', 'Export Users']);
    });
  });
});
