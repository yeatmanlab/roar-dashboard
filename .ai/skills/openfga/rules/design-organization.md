---
title: Organization-Level Access
impact: HIGH
impactDescription: multi-tenant authorization
tags: design, organization, multi-tenant, membership
---

## Organization-Level Access

Model organization membership and propagate access to owned resources.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define member: [user]
    define admin: [user]

type project
  relations
    define organization: [organization]
    define owner: [user] or admin from organization
    define editor: [user] or owner
    define viewer: [user] or editor or member from organization
```

**Tuples:**

```yaml
# Organization membership
- user: user:anne
  relation: admin
  object: organization:acme

- user: user:bob
  relation: member
  object: organization:acme

# Project belongs to organization
- user: organization:acme
  relation: organization
  object: project:website
```

**Access results:**
- Anne (admin): can own, edit, and view the project
- Bob (member): can view the project
- All through organization membership

**Extended pattern with teams:**

```dsl.openfga
type team
  relations
    define organization: [organization]
    define member: [user]

type project
  relations
    define organization: [organization]
    define team: [team]
    define viewer: [user] or member from team or member from organization
```

**Multi-tenant isolation:**

```dsl.openfga
type organization
  relations
    define member: [user]

type resource
  relations
    define organization: [organization]
    # Only org members can have any access
    define viewer: member from organization
```

This ensures resources are only visible within their organization.
