---
title: Naming Conventions
impact: MEDIUM
impactDescription: maintainability
tags: design, naming, conventions, readability
---

## Naming Conventions

Use consistent naming conventions for clarity and maintainability.

**Types - use singular nouns in lowercase:**

```dsl.openfga
# Correct
type user
type document
type folder
type organization
type team
type project

# Incorrect
type Users      # No capitals
type documents  # Not plural
type FOLDER     # Not all caps
```

**Relations - use descriptive names:**

```dsl.openfga
type document
  relations
    # Roles (who someone is)
    define owner: [user]
    define editor: [user]
    define viewer: [user]
    define admin: [user]
    define member: [user]

    # Structural (relationships between objects)
    define parent_folder: [folder]
    define organization: [organization]
    define parent: [document]

    # Permissions (what someone can do)
    define can_view: viewer
    define can_edit: editor
    define can_delete: owner
    define can_share: owner
```

**Object identifiers - use meaningful, readable IDs:**

```yaml
# Good
- object: document:roadmap-2024
- object: organization:acme-corp
- object: folder:engineering-docs
- object: user:anne-smith

# Avoid
- object: document:12345      # Meaningless ID
- object: organization:org1   # Non-descriptive
- object: folder:f_001        # Cryptic
```

**Consistency guidelines:**
- Use snake_case for multi-word relations: `parent_folder`, `can_view`
- Use kebab-case for object IDs: `roadmap-2024`, `acme-corp`
- Prefix permissions with `can_`: `can_view`, `can_edit`, `can_delete`
- Use nouns for roles: `owner`, `editor`, `viewer`, `admin`
