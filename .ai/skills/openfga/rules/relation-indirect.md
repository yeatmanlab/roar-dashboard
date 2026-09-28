---
title: Indirect Relationships with X from Y
impact: CRITICAL
impactDescription: scalable hierarchical access
tags: relations, indirect, from, hierarchy, scalability
---

## Indirect Relationships with X from Y

The `X from Y` pattern grants access through an intermediary object, enabling hierarchical permissions.

**Incorrect (requires tuples on every document):**

```dsl.openfga
type folder
  relations
    define viewer: [user]

type document
  relations
    define viewer: [user]
```

Each document needs its own viewer tuples even if they're in the same folder.

**Correct (inherit from parent folder):**

```dsl.openfga
type folder
  relations
    define viewer: [user]

type document
  relations
    define parent_folder: [folder]
    define viewer: [user] or viewer from parent_folder
```

**Tuples:**

```yaml
# Grant folder access once
- user: user:anne
  relation: viewer
  object: folder:engineering

# Link documents to folder
- user: folder:engineering
  relation: parent_folder
  object: document:spec
- user: folder:engineering
  relation: parent_folder
  object: document:design
```

Anne can view all documents in the engineering folder with just one permission tuple.

**Common patterns:**
- `viewer from parent_folder` - Folder inheritance
- `admin from organization` - Org-level admin access
- `member from team` - Team membership propagation

**Benefits:**
- Dramatically reduces tuple count
- Simplifies permission management
- Enables revoking access by deleting a single tuple
