const sidebarActionOptions = [
  {
    title: 'Back to Dashboard',
    icon: 'pi pi-arrow-left',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: false,
    project: 'ALL',
    category: 'home',
  },
  {
    title: 'List organizations',
    icon: 'pi pi-list',
    buttonLink: { name: 'ListOrgs' },
    requiresSuperAdmin: false,
    requiresAdmin: false,
    project: 'ALL',
    category: 'orgs',
  },
  {
    title: 'Create organization',
    icon: 'pi pi-database',
    buttonLink: { name: 'CreateOrgs' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'orgs',
  },
  {
    title: 'Register students',
    icon: 'pi pi-users',
    buttonLink: { name: 'RegisterStudents' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ROAR',
    category: 'users',
  },
  {
    title: 'Register administrator',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'CreateAdministrator' },
    requiresSuperAdmin: true,
    project: 'ALL',
    category: 'users',
  },
  {
    title: 'Create administration',
    icon: 'pi pi-question-circle',
    buttonLink: { name: 'CreateAdministration' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'orgs',
  },
  {
    title: 'Register Task',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'RegisterGame' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'register-task',
  },
  {
    title: 'Register Users',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'Register Users' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
    category: 'users',
  },
];

export const getSidebarActions = ({ isSuperAdmin = false, isAdmin = false, includeHomeLink = true }) => {
  if (import.meta.env.MODE === 'LEVANTE') {
    return sidebarActionOptions.filter((action) => {
      if (action.project === 'LEVANTE' || action.project === 'ALL') {
        if ((action.requiresSuperAdmin && !isSuperAdmin) || (action.requiresAdmin && !isAdmin)) {
          return false;
        }
        return true;
      }
    });
  } else {
    const actions = sidebarActionOptions.filter((action) => {
      if (action.project === 'ROAR' || action.project === 'ALL') {
        if (action.requiresSuperAdmin && !isSuperAdmin) {
          return false;
        }
        return true;
      }
    });
    const actionsWithHomeLink = actions.filter((action) => {
      if (!includeHomeLink && action.buttonLink.name === 'Home') {
        return false;
      }
      return true;
    });

    return actionsWithHomeLink;
  }
};
