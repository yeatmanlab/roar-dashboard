import { computed } from 'vue';
import { ORG_EXPORT_EVENTS } from '../constants/exportConstants';

/**
 * Composable for generating organization table columns based on org type and permissions.
 *
 * @param {Ref<string>} activeOrgType - The active organization type
 * @param {Ref<boolean>} isSuperAdmin - Whether the user is a super admin
 * @param {Function} userCan - Permission check function
 * @param {Object} Permissions - Permissions object with permission constants
 * @returns {object} Table columns computed property
 */
export function useOrgTableColumns(activeOrgType, isSuperAdmin, userCan, Permissions) {
  const tableColumns = computed(() => {
    const columns = [
      { field: 'name', header: 'Name', dataType: 'string', pinned: true, sort: true },
      { field: 'abbreviation', header: 'Abbreviation', dataType: 'string', sort: true },
      { field: 'address.formattedAddress', header: 'Address', dataType: 'string', sort: true },
      { field: 'tags', header: 'Tags', dataType: 'array', chip: true, sort: false },
    ];

    // Add MDR Number and NCES ID for districts and schools
    if (['districts', 'schools'].includes(activeOrgType.value)) {
      columns.push(
        { field: 'mdrNumber', header: 'MDR Number', dataType: 'string', sort: false },
        { field: 'ncesId', header: 'NCES ID', dataType: 'string', sort: false },
      );
    }

    // Add SSO integration columns for districts, schools, and classes
    if (['districts', 'schools', 'classes'].includes(activeOrgType.value)) {
      columns.push({ field: 'clever', header: 'Clever', dataType: 'boolean', sort: false });
      columns.push({ field: 'classlink', header: 'ClassLink', dataType: 'boolean', sort: false });
    }

    // Add Users link if user has permission
    if (userCan(Permissions.Users.LIST)) {
      columns.push({
        header: 'Users',
        link: true,
        routeName: 'ListUsers',
        routeTooltip: 'View users',
        routeLabel: 'Users',
        routeIcon: 'pi pi-user',
        sort: false,
      });
    }

    // Add Edit button if user has permission
    if (userCan(Permissions.Organizations.UPDATE)) {
      columns.push({
        header: 'Edit',
        button: true,
        eventName: 'edit-button',
        buttonIcon: 'pi pi-pencil',
        sort: false,
      });
    }

    // Add Invite Users button for super admins
    if (isSuperAdmin.value) {
      columns.push({
        header: 'SignUp Code',
        buttonLabel: 'Invite Users',
        button: true,
        eventName: 'show-activation-code',
        buttonIcon: 'pi pi-send mr-2',
        sort: false,
      });
    }

    // Add Export Users button (always visible)
    columns.push({
      header: 'Export Users',
      buttonLabel: 'Export Users',
      button: true,
      eventName: ORG_EXPORT_EVENTS.EXPORT_ORG_USERS,
      buttonIcon: 'pi pi-download mr-2',
      sort: false,
    });

    return columns;
  });

  return {
    tableColumns,
  };
}
