import { usePermissions } from '../composables/usePermissions';
import { Permissions } from '@bdelab/roar-firekit';
const sidebarActionOptions = [
  {
    title: 'Back to Dashboard',
    icon: 'pi pi-arrow-left',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: false,
    project: 'ALL',
    category: 'Home',
  },
  {
    title: 'List Organizations',
    icon: 'pi pi-folder-open',
    buttonLink: { name: 'ListOrgs' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    permission: Permissions.Organizations.LIST,
    project: 'ALL',
    category: 'Organizations',
  },
  {
    title: 'Create Organization',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateOrgs' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Organizations.CREATE,
    project: 'ALL',
    category: 'Organizations',
  },
  {
    title: 'Register Students',
    icon: 'pi pi-users',
    buttonLink: { name: 'RegisterStudents' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Users.CREATE,
    project: 'ROAR',
    category: 'Users',
  },
  {
    title: 'Register Administrator',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'CreateAdministrator' },
    requiresSuperAdmin: true,
    permission: Permissions.Administrators.CREATE,
    project: 'ALL',
    category: 'Users',
  },
  {
    title: 'View Administrations',
    icon: 'pi pi-list',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    permission: Permissions.Administrations.LIST,
    project: 'ALL',
    category: 'Administrations',
  },
  {
    title: 'Create Administration',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateAdministration', mode: 'create' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Administrations.CREATE,
    project: 'ALL',
    category: 'Administrations',
  },
  {
    title: 'Manage Tasks',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'ManageTasksVariants' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Tasks.UPDATE,
    project: 'ALL',
    category: 'Administrations',
  },
  {
    title: 'Register Users',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'Register Users' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
    category: 'Users',
  },
  {
    title: 'Register New Family',
    icon: 'pi pi-home',
    buttonLink: { name: 'Register' },
    requiresSuperAdmin: true,
    project: 'ROAR',
    category: 'Users',
  },
];

export const getSidebarActions = ({ isSuperAdmin = false, isAdmin = false }) => {
  const { userCan } = usePermissions();
  if (import.meta.env.MODE === 'LEVANTE') {
    return sidebarActionOptions.filter((action) => {
      if (action.project === 'LEVANTE' || action.project === 'ALL') {
        // If the action requires admin and the user is an admin, or if the action
        // requires super admin and the user is a super admin,
        // or if the action does not require admin or super admin,
        // the action will be in the dropdown
        if (
          (action.requiresAdmin && isAdmin) ||
          (action.requiresSuperAdmin && isSuperAdmin) ||
          (!action.requiresAdmin && !action.requiresSuperAdmin)
        ) {
          return true;
        } else {
          return false;
        }
      }
    });
  } else {
    const actions = sidebarActionOptions.filter((action) => {
      if (action.project === 'ROAR' || action.project === 'ALL') {
        // If the action requires a permission, check user's permissions.
        const permission = action.permission;
        if (Object.keys(action).includes('permission')) {
          return userCan(permission);
        }
        return true;
      }
    });

    return actions;
  }
};
