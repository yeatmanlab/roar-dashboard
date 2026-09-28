---
title: Type Restrictions
impact: LOW
impactDescription: model correctness
tags: optimization, type-restrictions, validation, safety
---

## Type Restrictions

Apply appropriate type restrictions to prevent invalid tuples.

**Incorrect (overly permissive):**

```dsl.openfga
type document
  relations
    define parent: [folder, document, user, organization]  # Too broad
```

**Correct (precise restrictions):**

```dsl.openfga
type document
  relations
    define parent_folder: [folder]      # Only folders can be parents
    define organization: [organization] # Only organizations
    define owner: [user]                # Only users can own
```

If business rules imply that a resource can belong to different kind of parents, then it is OK to represent it in the model:

```dsl.openfga
type organization
  define member: [user]
type business_unit
  define member: [user]

type document
  relations
    define parent_entity: [organization, business_unit]
    define parent_folder: [folder]      # Only folders can be parents
    define owner: [user]                # Only users can own
    define can_view: owner or member from parent_entity
```


**Common type restriction patterns:**

```dsl.openfga
# Only users
define owner: [user]

# Users or usersets (team members)
define editor: [user, team#member]

# Only organizational objects
define parent: [organization]

# Users with conditions
define admin: [user with time_based]

# Public access (use carefully)
define viewer: [user, user:*]
```

**Type restrictions:**
- Prevent invalid tuples from being written
- Make the model self-documenting
- Enable better tooling support
- Catch errors at write time, not check time

**Anti-pattern - kitchen sink:**

```dsl.openfga
# Don't do this - too permissive
define viewer: [user, user:*, team, team#member, organization, organization#member, role#assignee]
```

Instead, be specific about what types make sense for each relation.
