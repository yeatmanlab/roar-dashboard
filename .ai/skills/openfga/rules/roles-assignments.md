---
title: Role Assignments for Resource-Specific Roles
impact: MEDIUM
impactDescription: per-resource role members
tags: roles, role-assignments, resource-specific, flexible
---

## Role Assignments for Resource-Specific Roles

For roles that can have different members on different levels of a resource hierarchy. DO NOT use this for top-level types like organizations.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type role
  relations
    define can_view_project: [user:*]
    define can_edit_project: [user:*]

type role_assignment
  relations
    define assignee: [user]
    define role: [role]

    define can_view_project: assignee and can_view_project from role
    define can_edit_project: assignee and can_edit_project from role

type organization
  relations
    define admin: [user]

type project
  relations
    define organization: [organization]
    define role_assignment: [role_assignment]

    define can_edit_project: can_edit_project from role_assignment or admin from organization
    define can_view_project: can_view_project from role_assignment or admin from organization
```

**Step 1: Define the role's permissions:**

```yaml
- user: user:*
  relation: can_view_project
  object: role:project-admin

- user: user:*
  relation: can_edit_project
  object: role:project-admin
```

**Step 2: Create role assignment with user and role:**

```yaml
- user: user:anne
  relation: assignee
  object: role_assignment:project-admin-website

- user: role:project-admin
  relation: role
  object: role_assignment:project-admin-website
```

**Step 3: Link role assignment to project:**

```yaml
- user: role_assignment:project-admin-website
  relation: role_assignment
  object: project:website
```

**Step 4: Link project to organization:**

```yaml
- user: organization:acme
  relation: organization
  object: project:website
```

**Use when:**
- Different users need the same role on different resources
- Per-project or per-team role membership varies
