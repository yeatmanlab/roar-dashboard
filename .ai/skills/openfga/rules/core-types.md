---
title: Define Types for Entity Classes
impact: CRITICAL
impactDescription: foundation of your model
tags: core, types, entities, model-structure
---

## Define Types for Entity Classes

Types define classes of objects in your system. Every entity that participates in authorization should have a type.

**Incorrect (missing types):**

```dsl.openfga
model
  schema 1.1

type user

type document
  relations
    define owner: [user]
    define viewer: [user]
```

This model is missing types for organizational structure that documents might belong to.

**Correct (comprehensive types):**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define member: [user]
    define admin: [user]

type folder
  relations
    define owner: [user]
    define viewer: [user]

type document
  relations
    define parent_folder: [folder]
    define organization: [organization]
    define owner: [user]
    define viewer: [user]
```

Identify all relevant entities: users, resources, organizational units, groups, and any containers.
