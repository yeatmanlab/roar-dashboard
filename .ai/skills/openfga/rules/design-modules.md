---
title: Modularize your modules with 'modules'
impact: MEDIUM
impactDescription: multiple-team collaboration
tags: design, best-practices
---

**CRITICAL**: Only do this when you are asked to modularize the model. By default, create models in a single file.

## Split the authorization model in modules

Create a module for each sub-domain an application. 

Define a 'core.fga' module with the types that should be used by all sub-domains (e.g. `organization`, `role`, `group`), and an individual '.fga' file for each sub-domain.

Create an 'fga.mod' file that includes all '.fga' files:

```yaml
schema: '1.2'
contents:
  - core.fga
  - wiki.fga
```

## Module Definition

Modules are stored in `.fga.` files and start with the `module` keyword

**core.fga**
```dsl.openfga
module core

type user

type organization
  relations
    define member: [user]
    define admin: [user]

type group
  relations
    define member: [user]
```

## Extending types from other modules

Each sub-domain frequently need to define top-level permission that are defined, for example, at the `organization` type. They can do by using the `extend type` syntax:

**wiki.fga**
```dsl.openfga
module wiki

extend type organization
  relations
    define can_create_space: admin


type space
  relations
    define organization: [organization]
    define can_view_pages: member from organization

type page
  relations
    define space: [space]
    define owner: [user]
```

- A single type can only be extended once per file
- The relations added must not already exist, or be part of another type extension

## Testing Models with Modules

When creating `.fga.yaml` files to test models that include modular models, you need to point to the `fga.mod` file:

```yaml
name: ModularDemo
model_file: ./fga.mod

tuples:
  - user: user:anne
    relation: admin
    object: organization:openfga
    object: project:openfga
tests:
  - name: Members can view projects
    check:
      - user: user:anne
        object: organization:openfga
        assertions:
          admin: true
          member: true
          can_create_space: true
```

