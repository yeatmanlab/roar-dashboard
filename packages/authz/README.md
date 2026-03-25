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
define can_list: member
define can_delete: admin_tier
```

### All 13 OneRoster roles

Each role is modeled as its own FGA relation — no tier mapping. Tuples use the role name directly from Postgres.

| Role | FGA relation | Tier | Cascading |
|------|-------------|------|-----------|
| `system_administrator` | `system_administrator` | siteAdmin | Down + subtree (supervisory) |
| `site_administrator` | `site_administrator` | siteAdmin | Down + subtree |
| `district_administrator` | `district_administrator` | admin | Down + subtree |
| `administrator` | `administrator` | admin | Down + subtree |
| `principal` | `principal` | educator | Down + subtree |
| `counselor` | `counselor` | educator | Down + subtree |
| `teacher` | `teacher` | educator | Down + subtree |
| `aide` | `aide` | educator | Down + subtree |
| `proctor` | `proctor` | educator | Down + subtree |
| `student` | `student` | student | Up (supervised) |
| `guardian` | `guardian` | caregiver | Up |
| `parent` | `parent` | caregiver | Up |
| `relative` | `relative` | caregiver | Up |

> **No `parent` rename needed:** The hierarchy links use `parent_org` (e.g., `define parent_org: [district]` on `school`), so there is no conflict with the `parent` role relation. Tuples use `parent` directly.

### Computed role groups

Shared across org types to simplify permission definitions:

- **`admin_tier`** — siteAdmin + admin roles (system_administrator, site_administrator, district_administrator, administrator)
- **`educator_tier`** — educator roles (principal, counselor, teacher, aide, proctor)
- **`caregiver_tier`** — caregiver roles (guardian, parent, relative)
- **`supervisory_tier_group`** — all supervisory roles (`admin_tier` + `educator_tier`)
- **`member`** — all roles (`supervisory_tier_group` + student + `caregiver_tier`)

### Permissions

Permissions are defined as computed relations in each type in `authorization-model.fga`. See the model for the authoritative mapping of which role tiers grant which permissions. CUD permissions (`can_create`, `can_update`, `can_delete`) resolve to `no_one` — they are super-admin-only, enforced in the app layer.

**Design notes:**

- **`can_list_users` on family:** Gated on `parent` — only parents can list family members. Children cannot.
- **Groups have the full role model:** `user_groups` has a `role` column like `user_orgs`, so groups define all 13 roles with `active_membership` conditions, not just flat `member`.
- **Groups are standalone — no org hierarchy cascading:** Groups have no `parent_org` link, so org-level roles (e.g., district admin) do not cascade into groups. A user must be an explicit member of a group to see it. This is intentional — groups are independent of the org tree.

## Bidirectional hierarchy

FGA's `from parent_org` only cascades **downward** (parent -> child). This handles supervisory roles: a district administrator at `district:D` inherits into `school:A` via `or district_administrator from parent_org`.

But supervised roles need the **opposite** — a student at `school:A` must see administrations assigned to the parent `district:D`. The solution is **bidirectional hierarchy links**.

Each org link gets two tuples:

```
# Downward (supervisory cascading via `from parent_org`)
district:D    parent_org     school:A
school:A      parent_org     class:X

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

## Subtree supervisory access (administration ancestor access)

In the SQL model, a school teacher sees administrations assigned to the parent district because the `isDescendantOrEqual` ltree operator matches both the entity where the user has a role AND its ancestors. Supervisory roles cascade **down** in FGA (district admin → school → class), but they do **not** cascade **up** — a school teacher is NOT a district teacher.

Simply adding upward bubbling (`teacher from child_school` on district) would create **circular cascading**: a teacher at school-A would resolve as a teacher on the district, which would cascade back down to school-B via `teacher from parent_org`, breaking school isolation.

The solution is `subtree_supervisory_tier_group` — a computed relation on district and school that aggregates supervisory users from the full subtree without feeding into the org type's own permissions:

```
# On district (recursive — includes school subtrees, reaching class-level teachers):
define subtree_supervisory_tier_group: supervisory_tier_group or subtree_supervisory_tier_group from child_school

# On school:
define subtree_supervisory_tier_group: supervisory_tier_group or supervisory_tier_group from child_class
```

The `administration` type references these in its `supervisory_tier_group` definition:

```
define supervisory_tier_group: admin_tier or educator_tier
    or subtree_supervisory_tier_group from assigned_district
    or subtree_supervisory_tier_group from assigned_school
```

This gives the correct behavior:

| User | District entity | District-assigned administration |
|------|----------------|----------------------------------|
| District admin | `can_list: true` | `can_list: true` |
| School teacher | `can_list: false` (org isolation preserved) | `can_list: true` (via subtree) |
| Class teacher | `can_list: false` | `can_list: true` (via subtree, two hops) |

The key invariant: `subtree_supervisory_tier_group` is **never referenced by org permissions** (`can_list`, `can_read`, etc. still use `supervisory_tier_group`). It only flows into the administration type, so school/class isolation is preserved.

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
  relation: 'can_read',
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
2. If it's hierarchical, add bidirectional hierarchy links (`parent_org` + `child_*`)
3. Add tuple sync helpers in `apps/backend/src/authz/fga-tuples.ts`
4. Create a new `.fga.yaml` test file
5. Run `npm run test -w packages/authz`

## How service code changes

### Example: checking permission on a resource (runs.create)

**Before (SQL-based):**

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

**After (FGA):**

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
