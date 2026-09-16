---
title: Concentric Relationships
impact: HIGH
impactDescription: permission inheritance
tags: relations, concentric, or, inheritance
---

## Concentric Relationships

Use `or` to create nested permissions where one relation implies another.

**Incorrect (redundant tuples required):**

```dsl.openfga
type document
  relations
    define editor: [user]
    define viewer: [user]
```

This requires separate tuples for both editor and viewer access.

**Correct (editors inherit viewer access):**

```dsl.openfga
type document
  relations
    define editor: [user]
    define viewer: [user] or editor
```

Now editors automatically have viewer access without additional tuples.

**Typical hierarchy:**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor
```

Owners can edit and view. Editors can view. Each level inherits from the one above.

**Benefits:**
- Fewer tuples needed
- Consistent permission semantics
- Easier to reason about access levels
