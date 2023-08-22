export const sidebarActionOptions = [
  {
    title: "Back to Dashboard",
    icon: "pi pi-arrow-left",
    buttonLink: { name: "Home" },
    requiresSuperAdmin: false,
  },
  {
    title: "Register students",
    icon: "pi pi-users",
    buttonLink: { name: "MassUploader" },
    requiresSuperAdmin: false,
  },
  {
    title: "Register an administrator",
    icon: "pi pi-user-plus",
    buttonLink: { name: "CreateAdministrator" },
    requiresSuperAdmin: true,
  },
  {
    title: "Create an organization",
    icon: "pi pi-database",
    buttonLink: { name: "CreateOrgs" },
    requiresSuperAdmin: true,
  },
  {
    title: "List organizations",
    icon: "pi pi-list",
    buttonLink: { name: "ListOrgs" },
    requiresSuperAdmin: false,
  },
  {
    title: "Create an assignment",
    icon: "pi pi-plus-circle",
    buttonLink: { name: "CreateAdministration" },
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