import { computed } from 'vue';
import { ORG_EXPORT_EVENTS } from '../constants/exportConstants';
import { ORG_TYPES } from '@/constants/orgTypes';

/**
 * Composable for generating organization table columns based on org type and permissions.
 *
 * Address, Tags, Clever, and ClassLink columns were intentionally dropped during
 * the ts-rest backend migration — the backend org schemas don't expose those
 * fields, so the columns would always render empty.
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
      { field: 'name', header: 'Name', dataType: 'text', pinned: true, sort: true },
      { field: 'abbreviation', header: 'Abbreviation', dataType: 'text', sort: true },
    ];

    // Add MDR Number and NCES ID for districts and schools
    if (['districts', 'schools'].includes(activeOrgType.value)) {
      columns.push(
        { field: 'mdrNumber', header: 'MDR Number', dataType: 'text', sort: false },
        { field: 'ncesId', header: 'NCES ID', dataType: 'text', sort: false },
      );
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

    // Add Invite Users button for super admins, groups only. Activation
    // (invitation) codes for districts/schools/classes were intentionally
    // dropped during the ts-rest backend migration — only groups expose an
    // invitation-code endpoint (GET /groups/:groupId/invitation-code).
    if (isSuperAdmin.value && activeOrgType.value === ORG_TYPES.GROUPS) {
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
