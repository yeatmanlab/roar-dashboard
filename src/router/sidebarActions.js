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
    title: 'List organizations',
    icon: 'pi pi-folder-open',
    buttonLink: { name: 'ListOrgs' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Organizations',
  },
  {
    title: 'Create organization',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateOrgs' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Organizations',
  },
  {
    title: 'Register students',
    icon: 'pi pi-users',
    buttonLink: { name: 'RegisterStudents' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ROAR',
    category: 'Users',
  },
  {
    title: 'Register administrator',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'CreateAdministrator' },
    requiresSuperAdmin: true,
    project: 'ALL',
    category: 'Users',
  },
  {
    title: 'View administrations',
    icon: 'pi pi-list',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Administrations',
  },
  {
    title: 'Create administration',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateAdministration' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Administrations',
  },
  {
    title: 'Manage Tasks',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'ManageTasks' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
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
        if (action.requiresSuperAdmin && !isSuperAdmin) {
          return false;
        }
        if (action.requiresAdmin && !isAdmin) {
          return false;
        }
        return true;
      }
    });

    return actions;
  }
};
