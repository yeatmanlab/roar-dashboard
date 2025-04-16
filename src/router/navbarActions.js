import { isLevante } from '../helpers';

const navbarActionOptions = [
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
    title: 'Audiences',
    buttonLink: { name: 'ListAudiences' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Audience',
  },
  {
    title: 'View Assignments',
    icon: 'pi pi-list',
    buttonLink: { name: 'Home' },
    requiresSuperAdmin: false,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Assignments',
  },
  {
    title: 'Create Assignment',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateAssignment' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'ALL',
    category: 'Assignments',
  },
  {
    title: 'Manage Tasks',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'ManageTasksVariants' },
    requiresSuperAdmin: true,
    project: 'ALL',
    category: 'Assignments',
  },
  // TO DO: REMOVE USER "ACTIONS" AFTER NAMING 3 IS COMPLETE
  {
    title: 'Add Users',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'Add Users' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
    category: 'Users',
  },
  {
    title: 'Link Users',
    icon: 'pi pi-link',
    buttonLink: { name: 'Link Users' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
    category: 'Users',
  },
  {
    title: 'Edit Users',
    icon: 'pi pi-pencil',
    buttonLink: { name: 'Edit Users' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
    category: 'Users',
  },
  {
    title: 'Sync Passwords',
    icon: 'pi pi-arrows-h',
    buttonLink: { name: 'Sync Passwords' },
    requiresSuperAdmin: true,
    requiresAdmin: true,
    project: 'LEVANTE',
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
];

export const getNavbarActions = ({ isSuperAdmin = false, isAdmin = false }) => {
  // TODO: Remove ROAR logic 
  if (isLevante) {
    return navbarActionOptions.filter((action) => {
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
    const actions = navbarActionOptions.filter((action) => {
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
