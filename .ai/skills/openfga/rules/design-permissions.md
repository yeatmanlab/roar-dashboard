---
title: Define Permissions with can_ Relations
impact: HIGH
impactDescription: clear permission semantics
tags: design, permissions, can_, best-practices
---

## Define Permissions with can_ Relations

Define specific permissions using `can_<action>` relations that cannot be directly assigned.

**Incorrect (checking relations directly):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor
```

Application checks `editor` relation but semantics are unclear.

**Correct (explicit permissions):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor

    define can_view: viewer
    define can_edit: editor
    define can_delete: owner
    define can_share: owner
```

**Application code:**

```typescript
// Clear intent - checking specific permissions
await fga.check({ user, relation: 'can_view', object: doc })
await fga.check({ user, relation: 'can_edit', object: doc })
await fga.check({ user, relation: 'can_delete', object: doc })
```

**Benefits:**
- Clear separation between roles and permissions
- Permissions can combine multiple roles
- Easier to evolve without breaking applications
- Self-documenting model

**Advanced: Permission from multiple sources:**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user]
    define org: [organization]

    # Permission can come from direct role OR org admin
    define can_delete: owner or admin from org
```
