export const sidebarActionOptions = [
  {
    title: "Back to Dashboard",
    icon: "pi pi-arrow-left",
    buttonLink: { name: "Home" },
    requiresSuperAdmin: false,
  },
  {
    title: "List organizations",
    icon: "pi pi-list",
    buttonLink: { name: "ListOrgs" },
    requiresSuperAdmin: false,
  },
  {
    title: "Create organization",
    icon: "pi pi-database",
    buttonLink: { name: "CreateOrgs" },
    requiresSuperAdmin: true,
  },
  {
    title: "Register students",
    icon: "pi pi-users",
    buttonLink: { name: "RegisterStudents" },
    requiresSuperAdmin: true,
  },
  {
    title: "Register administrator",
    icon: "pi pi-user-plus",
    buttonLink: { name: "CreateAdministrator" },
    requiresSuperAdmin: true,
  },
  {
    title: "Create administration",
    icon: "pi pi-question-circle",
    buttonLink: { name: "CreateAdministration" },
    requiresSuperAdmin: true,
  },
  {
    title: "Register Task",
    icon: "pi pi-pencil",
    buttonLink: { name: "RegisterGame" },
    requiresSuperAdmin: true,
  },
]

export const getSidebarActions = (isSuperAdmin = false, includeHomeLink = true) => {
  const actions = sidebarActionOptions.filter((action) => {
    if (action.requiresSuperAdmin && !isSuperAdmin) {
      return false;
    }
    return true;
  });
  const actionsWithHomeLink = actions.filter((action) => {
    if (!includeHomeLink && action.buttonLink.name === "Home") {
      return false;
    }
    return true;
  });

  return actionsWithHomeLink;
}