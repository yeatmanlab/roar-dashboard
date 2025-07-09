import { usePermissions } from '../composables/usePermissions';
import { Permissions } from '@bdelab/roar-firekit';
import { ADMINISTRATION_FORM_TYPES } from '../constants/routes';

const sidebarActionOptions = [
  {
    title: 'Back to Dashboard',
    icon: 'pi pi-arrow-left',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: false,
    category: 'Home',
  },
  {
    title: 'List Organizations',
    icon: 'pi pi-folder-open',
    buttonLink: { name: 'ListOrgs' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    permission: Permissions.Organizations.LIST,
    category: 'Organizations',
  },
  {
    title: 'Create Organization',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateOrgs' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Organizations.CREATE,
    category: 'Organizations',
  },
  {
    title: 'Register Students',
    icon: 'pi pi-users',
    buttonLink: { name: 'RegisterStudents' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Users.CREATE,
    category: 'Users',
  },
  {
    title: 'Register Administrator',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'CreateAdministrator' },
    requiresSuperAdmin: true,
    permission: Permissions.Administrators.CREATE,
    category: 'Users',
  },
  {
    title: 'View Administrations',
    icon: 'pi pi-list',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    permission: Permissions.Administrations.LIST,
    category: 'Administrations',
  },
  {
    title: 'Create Administration',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateAdministration', formType: ADMINISTRATION_FORM_TYPES.CREATE },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Administrations.CREATE,
    category: 'Administrations',
  },
  {
    title: 'Manage Tasks',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'ManageTasksVariants' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    permission: Permissions.Tasks.UPDATE,
    category: 'Administrations',
  },
  {
    title: 'Register New Family',
    icon: 'pi pi-home',
    buttonLink: { name: 'Register' },
    requiresSuperAdmin: true,
    category: 'Users',
  },
];

export const getSidebarActions = ({ isLaunchAdmin = false }) => {
  const { userCan } = usePermissions();
  if (isLaunchAdmin) {
    // Disable showing menu items for launch admins
    return [];
  }
  const actions = sidebarActionOptions.filter((action) => {
    // If the action requires a permission, check user's permissions.
    const permission = action.permission;
    if (Object.keys(action).includes('permission')) {
      return userCan(permission);
    }
    return true;
  });

  return actions;
};
