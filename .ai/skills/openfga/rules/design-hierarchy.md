---
title: Hierarchical Structures
impact: HIGH
impactDescription: scalable permission inheritance
tags: design, hierarchy, inheritance, folders
---

## Hierarchical Structures

Model parent-child relationships to enable permission inheritance through hierarchies.

**Example (folder hierarchy):**

```dsl.openfga
model
  schema 1.1

type user

type folder
  relations
    define parent_folder: [folder]
    define owner: [user] or owner from parent_folder
    define editor: [user] or owner or editor from parent_folder
    define viewer: [user] or editor or viewer from parent_folder

type document
  relations
    define parent_folder: [folder]
    define owner: [user] or owner from parent_folder
    define editor: [user] or owner or editor from parent_folder
    define viewer: [user] or editor or viewer from parent_folder
```

**Tuples for nested structure:**

```yaml
# Nested folder structure
- user: folder:root
  relation: parent_folder
  object: folder:engineering

- user: folder:engineering
  relation: parent_folder
  object: folder:backend

# Document in nested folder
- user: folder:backend
  relation: parent_folder
  object: document:api-spec

# Grant access at root
- user: user:cto
  relation: viewer
  object: folder:root
```

The CTO can view all documents in all nested folders with a single tuple.

**Key patterns:**
- Parent relations should allow the same type: `define parent_folder: [folder]`
- Permissions inherit via `X from parent_folder`
- Each level adds its own direct grants with `[user]`

**Benefits:**
- Single permission grant propagates to entire subtree
- Revoke access by removing one tuple
- Natural mapping to file system structures
