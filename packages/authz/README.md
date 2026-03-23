# @roar/authz — OpenFGA Authorization Model

This package contains the OpenFGA authorization model for the ROAR platform. It defines **who can access what** and **what they can do with it** using relationship-based access control (ReBAC).

The model replaces the SQL-based access control system (ltree UNION queries, `rolesForPermission()`, access-controls classes) with a declarative FGA schema.

## Quick start

```bash
# Install the FGA CLI (macOS)
brew install openfga/tap/fga

# Validate the model
npm run validate -w packages/authz

# Run all model tests
npm run test -w packages/authz
```

## Types and relations

### Entity types

| Type | Represents | Source table |
|------|-----------|-------------|
| `user` | A ROAR platform user | `app.users` |
| `district` | A district org | `app.orgs` (orgType=district) |
| `school` | A school org | `app.orgs` (orgType=school) |
| `class` | A class | `app.classes` |
| `group` | A group (ROAR at Home) | `app.groups` |
| `family` | A family unit | `app.families` |
| `administration` | An assessment administration | `app.administrations` |

**Excluded types:** Tasks, task variants, and runs inherit access from their administration. Courses, agreements, and invitation codes have no access control. These are checked in the service layer by verifying access to the parent administration.

### Roles vs. permissions

Following the [OpenFGA roles and permissions pattern](https://openfga.dev/docs/modeling/roles-and-permissions):

- **Roles** are writable relations with type restrictions (e.g., `[user with active_membership]`). Tuples are written for these.
- **Permissions** are computed relations with no type restrictions. They derive from roles via `or`/`and`. Application code checks permissions, never roles.

```
# Role (writable — tuples written for this)
define teacher: [user with active_membership]

# Permission (computed — derived from roles)
define can_view: member
define can_delete: system_administrator or site_administrator or ...
```

### All 13 OneRoster roles

Each role is modeled as its own FGA relation — no tier mapping. Tuples use the role name directly from Postgres.

| Role | FGA relation | Tier | Cascading |
|------|-------------|------|-----------|
| `system_administrator` | `system_administrator` | siteAdmin | Down (supervisory) |
| `site_administrator` | `site_administrator` | siteAdmin | Down |
| `district_administrator` | `district_administrator` | admin | Down |
| `administrator` | `administrator` | admin | Down |
| `principal` | `principal` | educator | Down |
| `counselor` | `counselor` | educator | Down |
| `teacher` | `teacher` | educator | Down |
| `aide` | `aide` | educator | Down |
| `proctor` | `proctor` | educator | Down |
| `student` | `student` | student | Up (supervised) |
| `guardian` | `guardian` | caregiver | Up |
| `parent` | **`parent_role`** | caregiver | Up |
| `relative` | `relative` | caregiver | Up |

> **`parent` -> `parent_role` rename:** The OneRoster role `parent` conflicts with the FGA relation `parent` used for hierarchy links (e.g., `parent: [district]` on `school`). In FGA, it's renamed to `parent_role`. The tuple sync maps this in `fgaRelationForRole()`.

### Computed role groups

Shared across org types to simplify permission definitions:

- **`supervisor`** — all 9 supervisory roles (siteAdmin + admin + educator tiers)
- **`member`** — all roles (`supervisor` + student + caregiver tiers)
- **`educator`** — class-level only (principal, counselor, teacher, aide, proctor)

### Permissions

Permissions encode the full `RolePermissions` matrix from `role-permissions.ts`:

| Permission | Who can do it | Used for |
|-----------|--------------|----------|
| `can_view` | All members | `administrations.list`, `administrations.read`, org/class listing |
| `can_delete` | siteAdmin + admin tiers | `administrations.delete` |
| `can_manage` | siteAdmin + admin tiers | Org/class management |
| `can_list_students` | All supervisory roles | Sub-resource listing |
| `can_list_users` | Supervisory + caregiver tiers | `users.list` |
| `can_read_scores` | Supervisory roles | `reports.score.read` (full) |
| `can_read_scores_basic` | Caregiver tier | `reports.score.read` (composite) |
| `can_read_progress` | Supervisory + caregiver | `reports.progress.read` |
| `can_create_run` | Student only | `runs.create` |
| `can_launch_task` | Student + caregiver | `tasks.launch` |

## Bidirectional hierarchy

FGA's `from parent` only cascades **downward** (parent -> child). This handles supervisory roles: a district administrator at `district:D` inherits into `school:A` via `or district_administrator from parent`.

But supervised roles need the **opposite** — a student at `school:A` must see administrations assigned to the parent `district:D`. The solution is **bidirectional hierarchy links**.

Each org link gets two tuples:

```
# Downward (supervisory cascading via `from parent`)
district:D    parent         school:A
school:A      parent         class:X

# Upward (supervised bubbling via `from child_school` / `from child_class`)
school:A      child_school   district:D
class:X       child_class    school:A
```

On `district`, supervised roles include `or student from child_school`:

```
define student: [user with active_membership] or student from child_school
```

FGA resolution for "is user:X a student of district:D?":
1. Check direct `student` tuples on `district:D`
2. Follow `child_school` to find `school:A`
3. Check `student` tuples on `school:A` (which in turn follows `child_class` to `class:X`)

This replaces the ltree ancestor/descendant UNION queries with pure FGA graph traversal.

## Enrollment dates (conditions)

Enrollment dates are enforced at check time using the `active_membership` [CEL condition](https://openfga.dev/docs/modeling/conditions).

**At tuple write time:** Include `grant_start` and `grant_end` in the condition context.

```yaml
- user: user:student-x
  relation: student
  object: class:class-a
  condition:
    name: active_membership
    context:
      grant_start: "2024-01-01T00:00:00Z"
      grant_end: "2024-12-31T23:59:59Z"
```

**At check time:** Pass `current_time` in the request context.

```typescript
const { allowed } = await fga.check({
  user: 'user:student-x',
  relation: 'can_view',
  object: 'administration:admin-1',
  context: { current_time: new Date().toISOString() },
});
```

**Null `enrollmentEnd`:** Use a far-future sentinel (`9999-12-31T23:59:59Z`) so the condition always evaluates to true for open-ended enrollments.

## Super admin bypass

Super admin is handled in the application layer, not the FGA model:

```typescript
if (authContext.isSuperAdmin) return repository.listAll(options);
// Only call FGA for non-super-admin users
```

This keeps the FGA model focused on the org/role/permission structure. A single `if (isSuperAdmin)` check is simpler than adding `or admin from system` to every permission relation across every type.

## How to extend

### Adding a new permission

1. Add the computed permission relation to the relevant type(s) in `authorization-model.fga`
2. Add test cases in the appropriate `.fga.yaml` test file
3. Run `npm run test -w packages/authz` to verify
4. Use the new permission in service code: `fga.check({ relation: 'can_new_thing', ... })`

### Adding a role-specific permission

To distinguish between roles (e.g., only `teacher` can do X, not `aide`):

```
define can_do_x: teacher
```

No tuple migration needed — individual roles are already modeled.

### Adding a new resource type

1. Add the new type with its relations in `authorization-model.fga`
2. If it's hierarchical, add bidirectional hierarchy links (`parent` + `child_*`)
3. Add tuple sync helpers in `apps/backend/src/authz/fga-tuples.ts`
4. Create a new `.fga.yaml` test file
5. Run `npm run test -w packages/authz`

## How service code changes

### Before (SQL-based)

```typescript
async function create(authContext, body) {
  // Call 1: 6-path SQL UNION to check access
  await administrationService.verifyAdministrationAccess(authContext, body.administrationId);
  // Call 2: Another UNION to check role permissions
  if (!isSuperAdmin) {
    const userRoles = await accessControls.getUserRolesForAdministration(userId, adminId);
    const allowedRoles = rolesForPermission(Permissions.Runs.CREATE);
    if (!userRoles.some(role => allowedRoles.includes(role))) throw new ApiError(/* 403 */);
  }
}
```

### After (FGA)

```typescript
async function create(authContext, body) {
  const admin = await administrationRepository.getById({ id: body.administrationId });
  if (!admin) throw new ApiError(/* 404 */);
  if (!isSuperAdmin) {
    // Single FGA call: encodes BOTH relationship access AND permission check
    const { allowed } = await fga.check({
      user: `user:${userId}`,
      relation: 'can_create_run',
      object: `administration:${body.administrationId}`,
      context: { current_time: new Date().toISOString() },
    });
    if (!allowed) throw new ApiError(/* 403 */);
  }
}
```

## Running tests

```bash
# Run all model tests
fga model test --tests tests/*.fga.yaml

# Run a specific test file
fga model test --tests tests/administration-permissions.fga.yaml

# Validate model syntax
fga model validate --file authorization-model.fga
```

## Test files

| File | Covers |
|------|--------|
| `administration-permissions.fga.yaml` | Administration access via all assignment types, all role tiers, list_objects |
| `org-permissions.fga.yaml` | District/school permissions, ancestor/descendant access, cross-org isolation |
| `class-permissions.fga.yaml` | Class permissions, school inheritance, caregiver access, sibling isolation |
| `group-permissions.fga.yaml` | Group membership, administration access via groups |
| `family-permissions.fga.yaml` | Parent/child relationships, cross-family isolation |
| `enrollment-dates.fga.yaml` | Before-start denial, during-active, after-end denial, null-end sentinel, org/class/group boundaries |
| `hierarchy-cascading.fga.yaml` | Supervisory down-cascading, supervised up-bubbling, no reverse cascading |
