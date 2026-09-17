/**
 * Pure helpers for the create-administrator form (`CreateAdministrator.vue`).
 *
 * These are extracted from the component so the authorization-significant logic
 * — which roles a creator may assign, and the exact `POST /users` body shape —
 * is unit-testable without mounting the component. The backend remains the
 * authoritative gate; this is client-side defense-in-depth and UX shaping.
 */

/**
 * Org-membership roles a creator may assign, in display order.
 *
 * `value` MUST match the backend `UserRoleSchema`
 * (packages/api-contract/src/v1/common/user.ts). There is deliberately no
 * "super admin" option — `isSuperAdmin` is not settable via the create API.
 * `platform_admin` is intentionally excluded here and appended only for
 * super-admin creators (see `getAssignableRoleOptions`), because the backend
 * blocks non-super-admins from creating platform admins.
 */
export const BASE_ROLE_OPTIONS = [
  { label: 'Administrator', value: 'administrator' },
  { label: 'District Administrator', value: 'district_administrator' },
  { label: 'Site Administrator', value: 'site_administrator' },
  { label: 'System Administrator', value: 'system_administrator' },
  { label: 'Principal', value: 'principal' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Aide', value: 'aide' },
  { label: 'Counselor', value: 'counselor' },
  { label: 'Proctor', value: 'proctor' },
];

/** The platform-admin role option, offered to super-admin creators only. */
export const PLATFORM_ADMIN_ROLE_OPTION = { label: 'Platform Admin', value: 'platform_admin' };

/**
 * Coarse `userType` (student | educator | caregiver | admin) derived from the
 * chosen membership role, mirroring the backend role→tier mapping in
 * apps/backend/src/constants/role-permissions.ts. The two are independent on the
 * backend (userType is stored as sent), so the form sets an accurate value
 * rather than labelling every created user an "admin". `system_administrator`
 * and `site_administrator` are admin-tier roles, so they map to `admin` (the
 * `userType` enum has no finer-grained admin value).
 */
export const ROLE_TO_USER_TYPE = {
  administrator: 'admin',
  district_administrator: 'admin',
  site_administrator: 'admin',
  system_administrator: 'admin',
  platform_admin: 'admin',
  principal: 'educator',
  teacher: 'educator',
  aide: 'educator',
  counselor: 'educator',
  proctor: 'educator',
};

/**
 * The role options a creator may assign.
 *
 * Super admins may additionally assign `platform_admin`; everyone else (and the
 * backend, for non-super-admins) is restricted to the base roles.
 *
 * @param {boolean} isSuperAdmin - Whether the current user is a super admin.
 * @returns {Array<{label: string, value: string}>} The assignable role options.
 */
export const getAssignableRoleOptions = (isSuperAdmin) =>
  isSuperAdmin ? [...BASE_ROLE_OPTIONS, PLATFORM_ADMIN_ROLE_OPTION] : BASE_ROLE_OPTIONS;

/**
 * Build the `POST /users` request body from the form state.
 *
 * Every selected org (district/school/class/group) is granted the single role
 * chosen in the role dropdown. `userType` is derived from that role via
 * `ROLE_TO_USER_TYPE` so the stored profile category matches the assigned role
 * rather than always being "admin". Families are intentionally not included (not
 * a valid org membership and the picker exposes no families tab). The middle
 * name is omitted entirely when blank, since the backend name schema allows
 * omitting it but its regex rejects an empty string.
 *
 * @param {Object} state - The form state (firstName, middleName, lastName,
 *   email, password, role, and the districts/schools/classes/groups arrays of
 *   `{ id }` objects).
 * @returns {Object} The request body for the create-user mutation.
 */
export const buildCreateUserPayload = (state) => {
  const membershipFor = (entityType) => (org) => ({ entityType, entityId: org.id, role: state.role });

  return {
    email: state.email,
    password: state.password,
    name: {
      first: state.firstName,
      last: state.lastName,
      ...(state.middleName ? { middle: state.middleName } : {}),
    },
    userType: ROLE_TO_USER_TYPE[state.role],
    memberships: [
      ...state.districts.map(membershipFor('district')),
      ...state.schools.map(membershipFor('school')),
      ...state.classes.map(membershipFor('class')),
      ...state.groups.map(membershipFor('group')),
    ],
  };
};
