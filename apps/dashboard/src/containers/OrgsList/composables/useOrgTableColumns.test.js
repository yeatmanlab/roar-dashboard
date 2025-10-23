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

      const baseColumns = tableColumns.value.filter((col) =>
        ['Name', 'Abbreviation', 'Address', 'Tags'].includes(col.header),
      );

      expect(baseColumns).toHaveLength(4);
      expect(baseColumns[0]).toMatchObject({
        field: 'name',
        header: 'Name',
        dataType: 'string',
        pinned: true,
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

  describe('SSO Integration Columns', () => {
    it('should include Clever and ClassLink columns for districts', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const cleverColumn = tableColumns.value.find((col) => col.header === 'Clever');
      const classlinkColumn = tableColumns.value.find((col) => col.header === 'ClassLink');

      expect(cleverColumn).toBeDefined();
      expect(cleverColumn).toMatchObject({
        field: 'clever',
        header: 'Clever',
        dataType: 'boolean',
        sort: false,
      });
      expect(classlinkColumn).toBeDefined();
      expect(classlinkColumn).toMatchObject({
        field: 'classlink',
        header: 'ClassLink',
        dataType: 'boolean',
        sort: false,
      });
    });

    it('should include Clever and ClassLink columns for schools', () => {
      const activeOrgType = ref('schools');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const cleverColumn = tableColumns.value.find((col) => col.header === 'Clever');
      const classlinkColumn = tableColumns.value.find((col) => col.header === 'ClassLink');

      expect(cleverColumn).toBeDefined();
      expect(classlinkColumn).toBeDefined();
    });

    it('should include Clever and ClassLink columns for classes', () => {
      const activeOrgType = ref('classes');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const cleverColumn = tableColumns.value.find((col) => col.header === 'Clever');
      const classlinkColumn = tableColumns.value.find((col) => col.header === 'ClassLink');

      expect(cleverColumn).toBeDefined();
      expect(classlinkColumn).toBeDefined();
    });

    it('should NOT include Clever and ClassLink columns for groups', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const cleverColumn = tableColumns.value.find((col) => col.header === 'Clever');
      const classlinkColumn = tableColumns.value.find((col) => col.header === 'ClassLink');

      expect(cleverColumn).toBeUndefined();
      expect(classlinkColumn).toBeUndefined();
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

  describe('Super Admin Columns', () => {
    it('should include Invite Users button for super admins', () => {
      const activeOrgType = ref('districts');
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

    it('should NOT include Invite Users button for non-super admins', () => {
      const activeOrgType = ref('districts');
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

    it('should update columns when isSuperAdmin changes', () => {
      const activeOrgType = ref('districts');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      // Initially no Invite Users button
      let inviteColumn = tableColumns.value.find((col) => col.header === 'SignUp Code');
      expect(inviteColumn).toBeUndefined();

      // Become super admin
      isSuperAdmin.value = true;

      // Now should have Invite Users button
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
      expect(headers[2]).toBe('Address');
      expect(headers[3]).toBe('Tags');

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

      expect(headers).toContain('Name');
      expect(headers).toContain('Abbreviation');
      expect(headers).toContain('Address');
      expect(headers).toContain('Tags');
      expect(headers).toContain('MDR Number');
      expect(headers).toContain('NCES ID');
      expect(headers).toContain('Clever');
      expect(headers).toContain('ClassLink');
      expect(headers).toContain('Users');
      expect(headers).toContain('Edit');
      expect(headers).toContain('SignUp Code');
      expect(headers).toContain('Export Users');
    });

    it('should include minimal columns for groups with no permissions', () => {
      const activeOrgType = ref('groups');
      const isSuperAdmin = ref(false);
      const userCan = vi.fn(() => false);

      const { tableColumns } = useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, mockPermissions);

      const headers = tableColumns.value.map((col) => col.header);

      // Should only have base columns + Export Users
      expect(headers).toEqual(['Name', 'Abbreviation', 'Address', 'Tags', 'Export Users']);
    });
  });
});
