---
title: Model vs Data Separation
impact: HIGH
impactDescription: architectural clarity
tags: core, architecture, model, tuples, separation
---

## Model vs Data Separation

The authorization model (schema) is static and defines structure. Relationship tuples (data) are dynamic and change frequently.

**Model characteristics:**
- Immutable; each modification creates a new version
- Changes rarely; only when product features change
- Defines the *possible* relationships

**Tuple characteristics:**
- Mutable; written and deleted as application state changes
- Changes frequently; as users gain/lose access
- Represents the *actual* relationships

**Example:**

```dsl.openfga
# Model (changes rarely)
type document
  relations
    define owner: [user]
    define viewer: [user] or owner
```

```yaml
# Tuples (change frequently)
- user: user:anne
  relation: owner
  object: document:roadmap
# This tuple can be added/removed as permissions change
```

This separation enables efficient permission evaluation and decouples core logic changes from specific user permission modifications.
