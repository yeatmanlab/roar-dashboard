---
title: Relations Belong on Object Types
impact: CRITICAL
impactDescription: correct model structure
tags: core, relations, types, model-structure
---

## Relations Belong on Object Types

Relations are defined on the types that represent resources being accessed, not on user types.

**Incorrect (relations on user type):**

```dsl.openfga
model
  schema 1.1

type user
  relations
    define owns_document: [document]  # Wrong! Relations go on the resource
```

**Correct (relations on resource type):**

```dsl.openfga
model
  schema 1.1

type user

type document
  relations
    define owner: [user]  # Correct! Defined on the resource
```

Ask "Can user U perform action A on object O?" — the relation belongs on type O.
