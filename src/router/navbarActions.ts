import { ROLES } from '@/constants/roles';

interface NavbarAction {
  title: string;
  icon?: string;
  buttonLink: { name: string; params?: Record<string, any> };
  allowedRoles: string[];
  category: string;
}

const navbarActionOptions: Readonly<NavbarAction>[] = [
  {
    title: 'Back to Dashboard',
    icon: 'pi pi-arrow-left',
    buttonLink: { name: 'Home' },
    allowedRoles: ['*'],
    category: 'Home',
  },
  {
    title: 'Groups',
    buttonLink: { name: 'ListGroups' },
    allowedRoles: [ROLES.RESEARCH_ASSISTANT, ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Groups',
  },
  {
    title: 'View Assignments',
    icon: 'pi pi-list',
    buttonLink: { name: 'Home' },
    allowedRoles: [ROLES.RESEARCH_ASSISTANT, ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Assignments',
  },
  {
    title: 'Create Assignment',
    icon: 'pi pi-sliders-h',
    buttonLink: { name: 'CreateAssignment' },
    allowedRoles: [ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Assignments',
  },
  {
    title: 'Add Users',
    icon: 'pi pi-user-plus',
    buttonLink: { name: 'Add Users' },
    allowedRoles: [ROLES.RESEARCH_ASSISTANT, ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Users',
  },
  {
    title: 'Link Users',
    icon: 'pi pi-link',
    buttonLink: { name: 'Link Users' },
    allowedRoles: [ROLES.RESEARCH_ASSISTANT, ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Users',
  },
  {
    title: 'Manage Administrators',
    icon: 'pi pi-users',
    buttonLink: { name: 'ManageAdministrators' },
    allowedRoles: [ROLES.RESEARCH_ASSISTANT, ROLES.ADMIN, ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN],
    category: 'Users',
  },
] as const;

interface GetNavbarActionsParams {
  userRole?: string;
}

export const getNavbarActions = ({ userRole }: GetNavbarActionsParams): Readonly<NavbarAction>[] => {
  return navbarActionOptions.filter((action) => {
    if (action.allowedRoles.includes('*')) {
      return true;
    }

    if (userRole && action.allowedRoles.includes(userRole)) {
      return true;
    }

    return false;
  });
};
