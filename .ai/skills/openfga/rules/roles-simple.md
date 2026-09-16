---
title: Simple Static Roles
impact: MEDIUM
impactDescription: organization-wide roles
tags: roles,  organization
---

## Simple User-Defined Roles

Always start with static roles defined in each type, unless you are asked to support custom-roles or user-defined roles

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define admin: [user]  # Static role
    define member: [user]  # Static role

type project
  relations
    define organization: [organization]
    define owner: [user]
    define editor: [user]
```

**Setting up a static role:**

```yaml
# 1. Define role permissions
- user: user:anne
  relation: admin
  object: organization:acme

- user: user:bob
  relation: admin
  object: project:website
```

**Use when:**
- Roles apply at the organization level
- Same role permissions everywhere
- Simple permission structure
