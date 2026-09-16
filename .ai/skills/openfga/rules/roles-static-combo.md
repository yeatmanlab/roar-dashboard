---
title: Combining Static and Custom Roles
impact: HIGH
impactDescription: practical role systems
tags: roles, static-roles, custom-roles, user-defined
---

## Combining Static and Custom Roles

Combine pre-defined static roles with user-defined custom roles for practical authorization systems.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type role
  relations
    define assignee: [user]

type organization
  relations
    # Static roles - known at design time
    define owner: [user]
    define admin: [user] or owner
    define member: [user] or admin

    # Permissions: combine static roles and custom roles
    define can_manage_billing: [role#assignee] or owner
    define can_manage_members: [role#assignee] or admin
    define can_view_analytics: [role#assignee] or member
    define can_create_projects: [role#assignee] or member
```

**Static roles provide baseline permissions:**

```yaml
# Org owner has all permissions through static role
- user: user:founder
  relation: owner
  object: organization:acme

# Admin has member permissions through concentric relationship
- user: user:cto
  relation: admin
  object: organization:acme
```

**Custom roles extend for specific needs:**

```yaml
# Create a "billing-admin" custom role
- user: role:acme-billing-admin#assignee
  relation: can_manage_billing
  object: organization:acme

# Assign user to the custom role
- user: user:accountant
  relation: assignee
  object: role:acme-billing-admin
```

**Benefits:**
- Static roles handle common patterns (owner, admin, member)
- Custom roles allow organizational flexibility
- Clear separation of concerns
- Easier to understand and audit

**Recommendation:** Always define static roles for known, common access patterns. Use custom roles for organization-specific extensions.
