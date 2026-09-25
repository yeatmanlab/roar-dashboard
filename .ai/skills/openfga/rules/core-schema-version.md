---
title: Schema Version
impact: HIGH
impactDescription: enables full feature set
tags: core, schema, version, model-structure
---

## Schema Version

Always use schema version 1.1 to access all OpenFGA features.

**Incorrect (missing schema version):**

```dsl.openfga
model

type user

type document
  relations
    define owner: [user]
```

**Correct (explicit schema version):**

```dsl.openfga
model
  schema 1.1

type user

type document
  relations
    define owner: [user]
```

Schema 1.1 enables conditions, intersection, exclusion, and other advanced features.
