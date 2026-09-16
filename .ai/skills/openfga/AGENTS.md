# OpenFGA Best Practices

**Version 1.0.0**
OpenFGA Community
January 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when authoring,
> generating, or refactoring OpenFGA authorization models. Humans
> may also find it useful, but guidance here is optimized for automation
> and consistency by AI-assisted workflows.

---

## Abstract

Comprehensive guide for authoring OpenFGA authorization models, designed for AI agents and LLMs. Covers core concepts, relationship patterns, testing methodologies, custom roles, and model optimization. Each section includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific guidance to ensure correct authorization modeling.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts) — **CRITICAL**
   - 1.1 [Define Types for Entity Classes](#11-define-types-for-entity-classes)
   - 1.2 [Schema Version](#12-schema-version)
   - 1.3 [Relations Belong on Object Types](#13-relations-belong-on-object-types)
   - 1.4 [Relationship Tuples as Facts](#14-relationship-tuples-as-facts)
   - 1.5 [Model vs Data Separation](#15-model-vs-data-separation)
2. [Relationship Definitions](#2-relationship-definitions) — **CRITICAL**
   - 2.1 [Direct Relationships](#21-direct-relationships)
   - 2.2 [Concentric Relationships](#22-concentric-relationships)
   - 2.3 [Indirect Relationships with X from Y](#23-indirect-relationships-with-x-from-y)
   - 2.4 [Usersets for Group-Based Access](#24-usersets-for-group-based-access)
   - 2.5 [Conditional Relationships](#25-conditional-relationships)
   - 2.6 [Wildcards for Public Access](#26-wildcards-for-public-access)
   - 2.7 [Wildcards for boolean attributes](#27-wildcards-for-boolean-attributes)
3. [Model Design](#3-model-design) — **HIGH**
   - 3.1 [Define Permissions with can_ Relations](#31-define-permissions-with-can_-relations)
   - 3.2 [Hierarchical Structures](#32-hierarchical-structures)
   - 3.3 [Organization-Level Access](#33-organization-level-access)
   - 3.4 [Naming Conventions](#34-naming-conventions)
   - 3.5 [Modularize your modules with 'modules'](#35-modularize-your-modules-with-modules)
4. [Testing & Validation](#4-testing-validation) — **HIGH**
   - 4.1 [Structure Tests in .fga.yaml](#41-structure-tests-in-fgayaml)
   - 4.2 [Check Assertions](#42-check-assertions)
   - 4.3 [List Objects Tests](#43-list-objects-tests)
   - 4.4 [List Users Tests](#44-list-users-tests)
   - 4.5 [Testing Conditions](#45-testing-conditions)
   - 4.6 [OpenFGA CLI Usage](#46-openfga-cli-usage)
5. [Custom Roles](#5-custom-roles) — **MEDIUM**
   - 5.1 [Simple Static Roles](#51-simple-static-roles)
   - 5.2 [Role Assignments for Resource-Specific Roles](#52-role-assignments-for-resource-specific-roles)
   - 5.3 [Combining Static and Custom Roles](#53-combining-static-and-custom-roles)
   - 5.4 [When to Use Each Role Pattern](#54-when-to-use-each-role-pattern)
6. [Optimization](#6-optimization) — **MEDIUM**
   - 6.1 [Simplify Models](#61-simplify-models)
   - 6.2 [Minimize Tuple Count](#62-minimize-tuple-count)
   - 6.3 [Type Restrictions](#63-type-restrictions)
7. [SDK Integration](#7-sdk-integration) — **HIGH**
   - 7.1 [JavaScript/TypeScript SDK](#71-javascripttypescript-sdk)
   - 7.2 [Go SDK](#72-go-sdk)
   - 7.3 [Python SDK](#73-python-sdk)
   - 7.4 [Java SDK](#74-java-sdk)
   - 7.5 [.NET SDK](#75-net-sdk)
8. [Workflow](#8-workflow) — **CRITICAL**
   - 8.1 [Always Validate Models](#81-always-validate-models)

---

## 1. Core Concepts

**Impact: CRITICAL**

Understanding core concepts is fundamental to creating correct and maintainable authorization models.

### 1.1 Define Types for Entity Classes

**Impact: CRITICAL (foundation of your model)**

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

### 1.2 Schema Version

**Impact: HIGH (enables full feature set)**

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

### 1.3 Relations Belong on Object Types

**Impact: CRITICAL (correct model structure)**

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

### 1.4 Relationship Tuples as Facts

**Impact: CRITICAL (model vs data)**

Relationship tuples represent facts about who has what relationship to what object. They are the data that brings your model to life.

**Model defines possibilities:**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user]
```

**Tuples establish facts:**

```yaml
tuples:
  - user: user:anne
    relation: owner
    object: document:roadmap
  - user: user:bob
    relation: editor
    object: document:roadmap
```

Without tuples, authorization checks will fail because the model only defines what is *possible*, not what *currently exists*.

**Key distinction:**
- Model = static schema defining possible relationships
- Tuples = dynamic data representing actual relationships

### 1.5 Model vs Data Separation

**Impact: HIGH (architectural clarity)**

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

---
## 2. Relationship Definitions

**Impact: CRITICAL**

The building blocks for expressing authorization logic in OpenFGA.

### 2.1 Direct Relationships

**Impact: CRITICAL (explicit access grants)**

Direct relationships require explicit relationship tuples. Use type restrictions to control what can be directly assigned.

**Type restriction patterns:**

| Pattern | Meaning | Example |
|---------|---------|---------|
| `[user]` | Only individual users | `define owner: [user]` |
| `[user, team#member]` | Users or team members | `define editor: [user, team#member]` |
| `[organization]` | Only organizations | `define parent: [organization]` |

**Example:**

```dsl.openfga
type document
  relations
    define owner: [user]
```

**Tuple to grant access:**

```yaml
- user: user:anne
  relation: owner
  object: document:roadmap
```

Without a tuple, user:anne has no owner relationship to document:roadmap.

**Common mistake:** Forgetting that direct relationships require explicit tuples. The model only defines what is *possible*.

### 2.2 Concentric Relationships

**Impact: HIGH (permission inheritance)**

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

### 2.3 Indirect Relationships with X from Y

**Impact: CRITICAL (scalable hierarchical access)**

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

### 2.4 Usersets for Group-Based Access

**Impact: HIGH (efficient group management)**

Usersets (`type#relation`) represent collections of users, enabling group-based access control.

**Syntax:** `type#relation` means "all users who have this relation to objects of this type"

**Example (team-based access):**

```dsl.openfga
type team
  relations
    define member: [user]

type document
  relations
    define editor: [user, team#member]
```

**Tuples:**

```yaml
# Add users to team
- user: user:anne
  relation: member
  object: team:engineering

- user: user:bob
  relation: member
  object: team:engineering

# Grant team access to document
- user: team:engineering#member
  relation: editor
  object: document:roadmap
```

Both Anne and Bob can edit the roadmap through their team membership.

**Important:** `team#member` means "members of a specific team". It does NOT mean "must be a team member to be an editor". Only use it when assigning access to a group.

**Common mistake:**

```dsl.openfga
# This does NOT mean "only team members can be editors"
define editor: [team#member]

# It means "you can assign all members of a specific team as editors"
```

### 2.5 Conditional Relationships

**Impact: MEDIUM (dynamic authorization)**

Conditions use CEL (Common Expression Language) to add runtime context to authorization decisions.

**Example (time-based access):**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define admin: [user with non_expired_grant]

condition non_expired_grant(current_time: timestamp, grant_time: timestamp, grant_duration: duration) {
  current_time < grant_time + grant_duration
}
```

**Important:** Conditions must be defined at the end of the model, after all type definitions.

**Conditional tuple:**

```yaml
- user: user:peter
  relation: admin
  object: organization:acme
  condition:
    name: non_expired_grant
    context:
      grant_time: "2024-02-01T00:00:00Z"
      grant_duration: 1h
```

**Check with context:**

```yaml
check:
  - user: user:peter
    object: organization:acme
    context:
      current_time: "2024-02-01T00:10:00Z"
    assertions:
      admin: true  # Within the 1-hour window
```

**Common use cases:**
- Time-based access (expiring grants)
- IP-based restrictions
- Feature flags
- Attribute-based conditions

### 2.6 Wildcards for Public Access

**Impact: LOW (use carefully)**

Wildcards (`type:*`) grant access a all instances of a user type to access a specfic object.

**Example (public documents):**

```dsl.openfga
type document
  relations
    define viewer: [user, user:*]
```

**Tuple for public access:**

```yaml
- user: user:*
  relation: viewer
  object: document:public-readme
```

All users can view the public-readme document.

**Correct usage scenarios:**
- Public documentation
- Shared resources everyone should access
- Anonymous/guest access patterns

**Incorrect usage (avoid):**

```dsl.openfga
# Don't use wildcards as a shortcut for "any user can be assigned"
type document
  relations
    define editor: [user:*]  # Too permissive for editing
```

### 2.7 Wildcards for boolean attributes

**Impact: MEDIUM (use carefully)**

Wildcards (`type:*`) grant access a all instances of a user type to access a specfic object. They can be used to simulate boolean attributes. 

**Example (feature entitlements):**

```dsl.openfga
type organization
  relations
    define member: [user]
    define feature_sso: [user:*] 
    define can_access_sso : feature_sso and member
```

Note that if the permission needs to check both for the 'boolean attribute' (feature_sso) and verify the user is a member of the organization.


**Tuples **

```yaml
- user: user:anne
  relation: member
  object: organization:acme

- user: user:*
  relation: feature_sso
  object: organization:acme
```

All members from the acme organization can access the 'feature_sso' feature.

**Correct usage scenarios:**
- Feature Flags
- Entitlements
- Boolean states ('enabled', 'active', 'published')

---
## 3. Model Design

**Impact: HIGH**

Design patterns that lead to maintainable and correct authorization models.

### 3.1 Define Permissions with can_ Relations

**Impact: HIGH (clear permission semantics)**

Define specific permissions using `can_<action>` relations that cannot be directly assigned.

**Incorrect (checking relations directly):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor
```

Application checks `editor` relation but semantics are unclear.

**Correct (explicit permissions):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor

    define can_view: viewer
    define can_edit: editor
    define can_delete: owner
    define can_share: owner
```

**Application code:**

```typescript
// Clear intent - checking specific permissions
await fga.check({ user, relation: 'can_view', object: doc })
await fga.check({ user, relation: 'can_edit', object: doc })
await fga.check({ user, relation: 'can_delete', object: doc })
```

**Benefits:**
- Clear separation between roles and permissions
- Permissions can combine multiple roles
- Easier to evolve without breaking applications
- Self-documenting model

**Advanced: Permission from multiple sources:**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user]
    define org: [organization]

    # Permission can come from direct role OR org admin
    define can_delete: owner or admin from org
```

### 3.2 Hierarchical Structures

**Impact: HIGH (scalable permission inheritance)**

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

### 3.3 Organization-Level Access

**Impact: HIGH (multi-tenant authorization)**

Model organization membership and propagate access to owned resources.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define member: [user]
    define admin: [user]

type project
  relations
    define organization: [organization]
    define owner: [user] or admin from organization
    define editor: [user] or owner
    define viewer: [user] or editor or member from organization
```

**Tuples:**

```yaml
# Organization membership
- user: user:anne
  relation: admin
  object: organization:acme

- user: user:bob
  relation: member
  object: organization:acme

# Project belongs to organization
- user: organization:acme
  relation: organization
  object: project:website
```

**Access results:**
- Anne (admin): can own, edit, and view the project
- Bob (member): can view the project
- All through organization membership

**Extended pattern with teams:**

```dsl.openfga
type team
  relations
    define organization: [organization]
    define member: [user]

type project
  relations
    define organization: [organization]
    define team: [team]
    define viewer: [user] or member from team or member from organization
```

**Multi-tenant isolation:**

```dsl.openfga
type organization
  relations
    define member: [user]

type resource
  relations
    define organization: [organization]
    # Only org members can have any access
    define viewer: member from organization
```

This ensures resources are only visible within their organization.

### 3.4 Naming Conventions

**Impact: MEDIUM (maintainability)**

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

### 3.5 Modularize your modules with 'modules'

**Impact: MEDIUM (multiple-team collaboration)**

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

---
## 4. Testing & Validation

**Impact: HIGH**

Thorough testing ensures your authorization model behaves as expected.

### 4.1 Structure Tests in .fga.yaml

**Impact: HIGH (test-driven authorization)**

The `.fga.yaml` file defines both your model and tests in a single file.

**Basic structure:**

```yaml
name: My Authorization Model Tests

model: |
  model
    schema 1.1

  type user

  type document
    relations
      define owner: [user]
      define editor: [user] or owner
      define viewer: [user] or editor

tuples:
  - user: user:anne
    relation: owner
    object: document:roadmap

  - user: user:bob
    relation: editor
    object: document:roadmap

tests:
  - name: Document access tests
    check:
      # Check assertions here
    list_objects:
      # List objects assertions here
    list_users:
      # List users assertions here
```

**Alternative (external files):**

```yaml
name: Model Tests
model_file: ./model.fga
tuple_file: ./tuples.yaml
```

**Alternative when using Modular Models:**

```yaml
name: Model Tests
model_file: ./fga.mod
tuple_file: ./tuples.yaml
```


**Multiple tuple files:**

```yaml
tuple_files:
  - ./users.yaml
  - ./permissions.yaml
  - ./org-structure.yaml
```

**Benefits:**
- Self-contained test definitions
- Version-controlled authorization logic
- Enables test-driven development for authorization

### 4.2 Check Assertions

**Impact: HIGH (verify permission grants)**

Check assertions verify whether a user has a specific relation to an object.

**Example:**

```yaml
tests:
  - name: Owner permissions
    check:
      - user: user:anne
        object: document:roadmap
        assertions:
          owner: true
          editor: true   # Inherited through concentric relationship
          viewer: true   # Inherited through concentric relationship
          can_delete: true

      - user: user:bob
        object: document:roadmap
        assertions:
          owner: false
          editor: true
          viewer: true
          can_delete: false
```

**Always test both positive and negative cases:**

```yaml
check:
  # Positive: user HAS access
  - user: user:anne
    object: document:secret
    assertions:
      viewer: true

  # Negative: user does NOT have access
  - user: user:mallory
    object: document:secret
    assertions:
      viewer: false
      editor: false
      owner: false
```

**Test boundary conditions:**

```yaml
check:
  # User with no tuples at all
  - user: user:unknown
    object: document:roadmap
    assertions:
      viewer: false

  # Object with no tuples at all
  - user: user:anne
    object: document:nonexistent
    assertions:
      viewer: false
```

### 4.3 List Objects Tests

**Impact: MEDIUM (verify object enumeration)**

List objects tests verify which objects a user has access to.

**Example:**

```yaml
tests:
  - name: List accessible documents
    list_objects:
      - user: user:anne
        type: document
        assertions:
          owner:
            - document:roadmap
          viewer:
            - document:roadmap
            - document:public-doc

      - user: user:bob
        type: document
        assertions:
          owner: []  # Empty list - no owned documents
          editor:
            - document:roadmap
```

**Test empty results:**

```yaml
list_objects:
  - user: user:unknown
    type: document
    assertions:
      owner: []
      viewer: []
```

**Test multiple object types:**

```yaml
list_objects:
  - user: user:anne
    type: document
    assertions:
      viewer:
        - document:roadmap
        - document:spec

  - user: user:anne
    type: folder
    assertions:
      viewer:
        - folder:engineering
```

**Use cases:**
- Building UI that shows accessible resources
- Auditing user access across the system
- Verifying hierarchical inheritance works correctly

### 4.4 List Users Tests

**Impact: MEDIUM (verify user enumeration)**

List users tests verify which users have access to an object.

**Example:**

```yaml
tests:
  - name: List document users
    list_users:
      - object: document:roadmap
        user_filter:
          - type: user
        assertions:
          owner:
            users:
              - user:anne
          editor:
            users:
              - user:anne
              - user:bob
          viewer:
            users:
              - user:anne
              - user:bob
```

**Test empty results:**

```yaml
list_users:
  - object: document:private
    user_filter:
      - type: user
    assertions:
      viewer:
        users: []
```

**User filter with relation (for usersets):**

```yaml
list_users:
  - object: document:roadmap
    user_filter:
      - type: team
        relation: member
    assertions:
      editor:
        users:
          - team:engineering#member
```

**User filter formats:**
- `type: user` - List individual users
- `type: team` with `relation: member` - List team usersets
- `type: user` with `user:*` - Include public access

**Use cases:**
- Auditing who has access to sensitive resources
- Building share dialogs showing current collaborators
- Compliance reporting

### 4.5 Testing Conditions

**Impact: MEDIUM (verify dynamic authorization)**

Test conditional relationships by providing context in your assertions.

**Example model:**

```dsl.openfga
model
  schema 1.1

type user

type resource
  relations
    define viewer: [user with in_allowed_ip_range]

condition in_allowed_ip_range(user_ip: string, allowed_range: string) {
  user_ip.startsWith(allowed_range)
}
```

**Conditional tuple:**

```yaml
tuples:
  - user: user:anne
    relation: viewer
    object: resource:internal
    condition:
      name: in_allowed_ip_range
      context:
        allowed_range: "192.168."
```

**Tests with context:**

```yaml
tests:
  - name: Conditional access tests
    check:
      # Access granted - IP matches
      - user: user:anne
        object: resource:internal
        context:
          user_ip: "192.168.1.100"
        assertions:
          viewer: true

      # Access denied - IP doesn't match
      - user: user:anne
        object: resource:internal
        context:
          user_ip: "10.0.0.50"
        assertions:
          viewer: false
```

**Time-based condition testing:**

```yaml
tests:
  - name: Time-based access
    check:
      # Within valid window
      - user: user:peter
        object: organization:acme
        context:
          current_time: "2024-02-01T00:10:00Z"
        assertions:
          admin: true

      # After window expired
      - user: user:peter
        object: organization:acme
        context:
          current_time: "2024-02-02T00:00:00Z"
        assertions:
          admin: false
```

**Always test both passing and failing condition evaluations.**

### 4.6 OpenFGA CLI Usage

**Impact: HIGH (validation workflow)**

Use the OpenFGA CLI to validate and test your models.

**MANDATORY**: Always run `fga model test` after creating or modifying any `.fga` or `.fga.yaml` file. Do not consider any OpenFGA task complete until tests pass.

Use the OpenFGA CLI to validate and test your models.

**Installation:**

```bash
# macOS
brew install openfga/tap/fga

# Debian
sudo apt install ./fga_<version>_linux_<arch>.deb

# Docker
docker pull openfga/cli
docker run -it openfga/cli
```

**Validate model syntax:**

```bash
fga model validate --file model.fga
```

**Run tests:**

```bash
fga model test --tests model.fga.yaml
```

**Transform between formats:**

```bash
# DSL to JSON
fga model transform --input model.fga --output model.json

# JSON to DSL
fga model transform --input model.json --output model.fga
```

**Example test run:**

```bash
$ fga model test --tests authorization.fga.yaml
# Test Summary #
Tests 1/1 passing
Checks 5/5 passing
```

**CI/CD integration:**

```bash
# Fail the build if tests don't pass
fga model test --tests authorization.fga.yaml || exit 1
```

You can also use the available GitHub actions. 

**Verbose output for debugging:**

```bash
fga model test --tests authorization.fga.yaml --verbose
```

---
## 5. Custom Roles

**Impact: MEDIUM**

Implement user-defined roles when applications need flexible permission structures.

### 5.1 Simple Static Roles

**Impact: MEDIUM (organization-wide roles)**

Always start with static roles defined in each type, unless you are asked to support custom-roles or user-defined roles

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type organization
  relations
    define admin: [user]  # Static role
    define member: [user]  # Static role

type project
  relations
    define organization: [organization]
    define owner: [user]
    define editor: [user]
```

**Setting up a static role:**

```yaml
# 1. Define role permissions
- user: user:anne
  relation: admin
  object: organization:acme

- user: user:bob
  relation: admin
  object: project:website
```

**Use when:**
- Roles apply at the organization level
- Same role permissions everywhere
- Simple permission structure

### 5.2 Role Assignments for Resource-Specific Roles

**Impact: MEDIUM (per-resource role members)**

For roles that can have different members on different levels of a resource hierarchy. DO NOT use this for top-level types like organizations.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type role
  relations
    define can_view_project: [user:*]
    define can_edit_project: [user:*]

type role_assignment
  relations
    define assignee: [user]
    define role: [role]

    define can_view_project: assignee and can_view_project from role
    define can_edit_project: assignee and can_edit_project from role

type organization
  relations
    define admin: [user]

type project
  relations
    define organization: [organization]
    define role_assignment: [role_assignment]

    define can_edit_project: can_edit_project from role_assignment or admin from organization
    define can_view_project: can_view_project from role_assignment or admin from organization
```

**Step 1: Define the role's permissions:**

```yaml
- user: user:*
  relation: can_view_project
  object: role:project-admin

- user: user:*
  relation: can_edit_project
  object: role:project-admin
```

**Step 2: Create role assignment with user and role:**

```yaml
- user: user:anne
  relation: assignee
  object: role_assignment:project-admin-website

- user: role:project-admin
  relation: role
  object: role_assignment:project-admin-website
```

**Step 3: Link role assignment to project:**

```yaml
- user: role_assignment:project-admin-website
  relation: role_assignment
  object: project:website
```

**Step 4: Link project to organization:**

```yaml
- user: organization:acme
  relation: organization
  object: project:website
```

**Use when:**
- Different users need the same role on different resources
- Per-project or per-team role membership varies

### 5.3 Combining Static and Custom Roles

**Impact: HIGH (practical role systems)**

Combine pre-defined static roles with user-defined custom roles for practical authorization systems.

**Model:**

```dsl.openfga
model
  schema 1.1

type user

type role
  relations
    define assignee: [user]

type organization
  relations
    # Static roles - known at design time
    define owner: [user]
    define admin: [user] or owner
    define member: [user] or admin

    # Permissions: combine static roles and custom roles
    define can_manage_billing: [role#assignee] or owner
    define can_manage_members: [role#assignee] or admin
    define can_view_analytics: [role#assignee] or member
    define can_create_projects: [role#assignee] or member
```

**Static roles provide baseline permissions:**

```yaml
# Org owner has all permissions through static role
- user: user:founder
  relation: owner
  object: organization:acme

# Admin has member permissions through concentric relationship
- user: user:cto
  relation: admin
  object: organization:acme
```

**Custom roles extend for specific needs:**

```yaml
# Create a "billing-admin" custom role
- user: role:acme-billing-admin#assignee
  relation: can_manage_billing
  object: organization:acme

# Assign user to the custom role
- user: user:accountant
  relation: assignee
  object: role:acme-billing-admin
```

**Benefits:**
- Static roles handle common patterns (owner, admin, member)
- Custom roles allow organizational flexibility
- Clear separation of concerns
- Easier to understand and audit

**Recommendation:** Always define static roles for known, common access patterns. Use custom roles for organization-specific extensions.

### 5.4 When to Use Each Role Pattern

**Impact: MEDIUM (choosing the right pattern)**

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Simple Static Roles** | Organization-wide roles with consistent permissions | Simple, efficient | Less flexible for per-resource customization |
| **Simple Custom Roles** | Custom organization-wide roles with consistent permissions | Simple, efficient | Less flexible for per-resource customization |
| **Role Assignments** | Custom resource-specific roles with different members per resource | Highly flexible | More complex, more tuples |

**Choose Simple Roles when:**
- Roles apply at the organization level
- Same users have the role everywhere
- Permission structure is straightforward
- You want minimal tuple management

**Example:** Organization billing admin, HR manager

**Choose Custom Roles when:**
- You need to let end-users define their own roles at the organization level
- Same users have the role everywhere
- Permission structure is straightforward
- You want minimal tuple management

**Example:** End-users can create a billing admin or HR admin role

**Choose Role Assignments when:**
- You need to let end-users define their own roles at the organization level
- Different users need the same role on different resources
- Per-project or per-team role membership varies
- Fine-grained resource-level control is required
- Role membership changes frequently per resource

**Example:** Project lead (different for each project)

**Migration strategies when evolving roles:**

1. **Additive approach:** Introduce custom roles alongside existing static roles
2. **Gradual migration:** Move permissions one at a time to custom roles
3. **Backwards compatibility:** Maintain existing static role behavior during transition

**Common mistake:** Using role assignments for organization-level roles. This adds unnecessary complexity. Use simple user-defined roles instead.

---
## 6. Optimization

**Impact: MEDIUM**

Optimize your models for clarity and efficiency.

### 6.1 Simplify Models

**Impact: MEDIUM (maintainability)**

Remove unused types and relations from your model.

**Incorrect (unused relations):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user]
    define viewer: [user]
    define commenter: [user]     # Never used in application
    define legacy_admin: [user]  # Deprecated, no tuples exist

    define can_view : owner or editor or viewer
```

**Correct (minimal model):**

```dsl.openfga
type document
  relations
    define owner: [user]
    define editor: [user]
    define viewer: [user]
    define can_view : owner or editor or viewer
```

**Audit checklist:**

1. **Unused types:** Remove types that have no tuples and aren't referenced
2. **Unused relations:** Remove relations that are never checked or written
3. **Unreferenced conditions:** Remove conditions not used in any relation
4. **Dead paths:** Remove `X from Y` paths where Y relation is never used

**After generating models and tests:**

```bash
# Check which relations are actually tested
grep -r "relation:" tests/*.yaml | sort | uniq

# Compare against model relations
fga model validate --file model.fga
```

**Benefits:**
- Easier to understand and maintain
- Faster validation
- Clearer documentation
- Reduced confusion for developers

### 6.2 Minimize Tuple Count

**Impact: MEDIUM (storage and performance)**

Use indirect relationships to reduce the number of tuples needed.

**Incorrect (tuple explosion):**

```yaml
# Granting viewer access to 100 documents individually
- user: user:anne
  relation: viewer
  object: document:doc-1
- user: user:anne
  relation: viewer
  object: document:doc-2
# ... 98 more tuples (100 total!)
```

**Correct (hierarchical access):**

```yaml
# Grant folder access once
- user: user:anne
  relation: viewer
  object: folder:engineering

# Documents inherit from folder (structural tuples)
- user: folder:engineering
  relation: parent_folder
  object: document:doc-1
- user: folder:engineering
  relation: parent_folder
  object: document:doc-2
# ... link documents to folder
```

One permission tuple + structural tuples scales better than individual grants.

**Team-based access:**

```yaml
# Instead of 50 individual user grants:
- user: user:alice
  relation: viewer
  object: document:spec
- user: user:bob
  relation: viewer
  object: document:spec
# ... 48 more

# Use team membership:
- user: team:engineering#member
  relation: viewer
  object: document:spec

# Add users to team separately
- user: user:alice
  relation: member
  object: team:engineering
```

**Benefits:**
- Fewer tuples to store and query
- Easier permission management
- Single point of revocation
- Better performance at scale

### 6.3 Type Restrictions

**Impact: LOW (model correctness)**

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

If business rules implies that a resource can belong to different kind of parents, then it is OK to represent it in the model:

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

---
## 7. SDK Integration

**Impact: HIGH**

SDK implementations for integrating OpenFGA into your applications.

### 7.1 JavaScript/TypeScript SDK

**Impact: HIGH (client implementation for JS/TS)**

The `@openfga/sdk` package provides the official OpenFGA client for JavaScript and TypeScript applications.

### Installation

```bash
npm install @openfga/sdk
```

### Client Initialization

**Basic setup:**

```typescript
const { OpenFgaClient } = require('@openfga/sdk');

const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  authorizationModelId: process.env.FGA_MODEL_ID,
});
```

**With API Token:**

```typescript
const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk');

const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  credentials: {
    method: CredentialsMethod.ApiToken,
    config: {
      token: process.env.FGA_API_TOKEN,
    }
  }
});
```

**With Client Credentials (OAuth2):**

```typescript
const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  storeId: process.env.FGA_STORE_ID,
  credentials: {
    method: CredentialsMethod.ClientCredentials,
    config: {
      apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER,
      apiAudience: process.env.FGA_API_AUDIENCE,
      clientId: process.env.FGA_CLIENT_ID,
      clientSecret: process.env.FGA_CLIENT_SECRET,
    }
  }
});
```

### Load Authorization Model from File

**From JSON file:**

```typescript
const fs = require('fs');

// Read and parse JSON model
const modelJson = JSON.parse(fs.readFileSync('model.json', 'utf8'));

const { authorization_model_id } = await fgaClient.writeAuthorizationModel(modelJson);
```

**From DSL (.fga) file:**

Use the `@openfga/syntax-transformer` package to convert DSL to JSON:

```bash
npm install @openfga/syntax-transformer
```

```typescript
const fs = require('fs');
const { transformer } = require('@openfga/syntax-transformer');

// Read DSL file and transform to JSON
const dslContent = fs.readFileSync('model.fga', 'utf8');
const modelJson = transformer.transformDSLToJSON(dslContent);

const { authorization_model_id } = await fgaClient.writeAuthorizationModel(
  JSON.parse(modelJson)
);
```

**Alternative: Use CLI for conversion**

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```typescript
const result = await fgaClient.check({
  user: "user:anne",
  relation: "viewer",
  object: "document:roadmap",
});
// result.allowed === true or false
```

### Batch Check

```typescript
const { result } = await fgaClient.batchCheck({
  checks: [
    { user: "user:anne", relation: "viewer", object: "document:roadmap" },
    { user: "user:bob", relation: "editor", object: "document:budget" }
  ]
});
```

### Write Tuples

```typescript
await fgaClient.write({
  writes: [
    { user: "user:anne", relation: "viewer", object: "document:roadmap" }
  ],
  deletes: [
    { user: "user:bob", relation: "editor", object: "document:budget" }
  ],
});

// Convenience methods
await fgaClient.writeTuples([
  { user: "user:anne", relation: "viewer", object: "document:roadmap" }
]);
await fgaClient.deleteTuples([
  { user: "user:bob", relation: "editor", object: "document:budget" }
]);
```

### List Objects

```typescript
const response = await fgaClient.listObjects({
  user: "user:anne",
  relation: "viewer",
  type: "document",
});
// response.objects = ["document:roadmap", "document:budget"]
```

### List Relations

```typescript
const response = await fgaClient.listRelations({
  user: "user:anne",
  object: "document:roadmap",
  relations: ["can_view", "can_edit", "can_delete"],
});
// response.relations = ["can_view", "can_edit"]
```

### List Users

```typescript
const response = await fgaClient.listUsers({
  object: { type: "document", id: "roadmap" },
  relation: "can_read",
  user_filters: [{ type: "user" }],
});
// response.users = [{ object: { type: "user", id: "anne" } }]
```

### Read Tuples

```typescript
const { tuples } = await fgaClient.read({
  user: "user:anne",
  relation: "viewer",
  object: "document:roadmap",
});
```

### Non-Transaction Write Mode

For large batch writes:

```typescript
const response = await fgaClient.write({
  writes: largeTupleArray,
}, {
  transaction: {
    disable: true,
    maxPerChunk: 100,
    maxParallelRequests: 10,
  }
});
```

### Handle Write Conflicts

```typescript
const { ClientWriteRequestOnDuplicateWrites } = require('@openfga/sdk');

await fgaClient.write({
  writes: [{ user: "user:anne", relation: "writer", object: "document:budget" }],
}, {
  conflict: {
    onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore,
  }
});
```

### Retry Configuration

```typescript
const fgaClient = new OpenFgaClient({
  apiUrl: process.env.FGA_API_URL,
  retryParams: {
    maxRetry: 3,
    minWaitInMs: 250
  }
});
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Input format:** Parameters use camelCase
- **Response format:** API responses use snake_case
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Batch operations:** Use `correlationId` to match responses to requests

### 7.2 Go SDK

**Impact: HIGH (client implementation for Go)**

The `github.com/openfga/go-sdk` package provides the official OpenFGA client for Go applications.

### Installation

```bash
go get -u github.com/openfga/go-sdk
go mod tidy
```

### Client Initialization

**Basic setup:**

```go
import openfga "github.com/openfga/go-sdk"

fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl:               os.Getenv("FGA_API_URL"),
    StoreId:              os.Getenv("FGA_STORE_ID"),
    AuthorizationModelId: os.Getenv("FGA_MODEL_ID"),
})
```

**With API Token:**

```go
import "github.com/openfga/go-sdk/credentials"

fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl:  os.Getenv("FGA_API_URL"),
    StoreId: os.Getenv("FGA_STORE_ID"),
    Credentials: &credentials.Credentials{
        Method: credentials.CredentialsMethodApiToken,
        Config: &credentials.Config{
            ApiToken: os.Getenv("FGA_API_TOKEN"),
        },
    },
})
```

**With Client Credentials (OAuth2):**

```go
fgaClient, err := NewSdkClient(&ClientConfiguration{
    ApiUrl: os.Getenv("FGA_API_URL"),
    Credentials: &credentials.Credentials{
        Method: credentials.CredentialsMethodClientCredentials,
        Config: &credentials.Config{
            ClientCredentialsClientId:       os.Getenv("FGA_CLIENT_ID"),
            ClientCredentialsClientSecret:   os.Getenv("FGA_CLIENT_SECRET"),
            ClientCredentialsApiAudience:    os.Getenv("FGA_API_AUDIENCE"),
            ClientCredentialsApiTokenIssuer: os.Getenv("FGA_API_TOKEN_ISSUER"),
        },
    },
})
```

### Check Permission

```go
data, err := fgaClient.Check(context.Background()).
    Body(ClientCheckRequest{
        User:     "user:anne",
        Relation: "viewer",
        Object:   "document:roadmap",
    }).
    Execute()
fmt.Printf("allowed: %t", data.GetAllowed())
```

### Batch Check

```go
body := ClientBatchCheckRequest{
    Checks: []ClientBatchCheckItem{{
        CorrelationId: "check-1",
        User:          "user:anne",
        Relation:      "viewer",
        Object:        "document:roadmap",
    }},
}
data, err := fgaClient.BatchCheck(context.Background()).Body(body).Execute()
// Results keyed by correlationId
```

### Write Tuples

```go
body := ClientWriteRequest{
    Writes: &[]ClientTupleKey{{
        User:     "user:anne",
        Relation: "viewer",
        Object:   "document:roadmap",
    }},
    Deletes: &[]ClientTupleKeyWithoutCondition{{
        User:     "user:bob",
        Relation: "editor",
        Object:   "document:budget",
    }},
}
err := fgaClient.Write(context.Background()).Body(body).Execute()
```

### List Objects

```go
data, err := fgaClient.ListObjects(context.Background()).
    Body(ClientListObjectsRequest{
        User:     "user:anne",
        Relation: "can_read",
        Type:     "document",
    }).
    Execute()
// data.Objects contains accessible object IDs
```

### Streamed List Objects

```go
response, err := fgaClient.StreamedListObjects(context.Background()).
    Body(ClientStreamedListObjectsRequest{
        User:     "user:anne",
        Relation: "can_read",
        Type:     "document",
    }).
    Execute()
defer response.Close()

for obj := range response.Objects {
    objects = append(objects, obj.Object)
}
```

### List Relations

```go
data, err := fgaClient.ListRelations(context.Background()).
    Body(ClientListRelationsRequest{
        User:      "user:anne",
        Object:    "document:roadmap",
        Relations: []string{"can_view", "can_edit"},
    }).
    Execute()
// data.Relations contains applicable relations
```

### List Users

```go
data, err := fgaClient.ListUsers(context.Background()).
    Body(ClientListUsersRequest{
        Object:      openfga.FgaObject{Type: "document", Id: "roadmap"},
        Relation:    "can_read",
        UserFilters: []openfga.UserTypeFilter{{Type: "user"}},
    }).
    Execute()
```

### Read Tuples

```go
data, err := fgaClient.Read(context.Background()).
    Body(ClientReadRequest{
        User:     openfga.PtrString("user:anne"),
        Relation: openfga.PtrString("viewer"),
        Object:   openfga.PtrString("document:roadmap"),
    }).
    Execute()
```

### Non-Transaction Write Mode

```go
options := ClientWriteOptions{
    Transaction: &TransactionOptions{
        Disable:             true,
        MaxParallelRequests: 5,
        MaxPerChunk:         100,
    },
}
data, err := fgaClient.Write(context.Background()).
    Body(body).
    Options(options).
    Execute()
```

### Load Authorization Model from File

**From JSON file:**

```go
import (
    "encoding/json"
    "os"
    openfga "github.com/openfga/go-sdk"
)

// Read JSON file
jsonContent, err := os.ReadFile("model.json")
if err != nil {
    log.Fatal(err)
}

// Parse into request body
var body openfga.WriteAuthorizationModelRequest
if err := json.Unmarshal(jsonContent, &body); err != nil {
    log.Fatal(err)
}

// Write the model
response, err := fgaClient.WriteAuthorizationModel(context.Background()).
    Body(body).
    Execute()
```

**From DSL (.fga) file:**

Install the language transformer:

```bash
go get github.com/openfga/language/pkg/go/transformer
```

```go
import (
    "encoding/json"
    "os"
    "github.com/openfga/language/pkg/go/transformer"
    openfga "github.com/openfga/go-sdk"
)

// Read DSL file
dslContent, err := os.ReadFile("model.fga")
if err != nil {
    log.Fatal(err)
}

// Transform DSL to JSON
jsonModel, err := transformer.TransformDSLToJSON(string(dslContent))
if err != nil {
    log.Fatal(err)
}

// Parse into request body
var body openfga.WriteAuthorizationModelRequest
if err := json.Unmarshal([]byte(jsonModel), &body); err != nil {
    log.Fatal(err)
}

// Write the model
response, err := fgaClient.WriteAuthorizationModel(context.Background()).
    Body(body).
    Execute()
```

### Contextual Tuples

```go
body := ClientCheckRequest{
    User:     "user:anne",
    Relation: "viewer",
    Object:   "document:roadmap",
    ContextualTuples: &[]ClientTupleKey{{
        User:     "user:anne",
        Relation: "editor",
        Object:   "document:roadmap",
    }},
}
```

### Retry Configuration

```go
fgaClient, err := NewSdkClient(&ClientConfiguration{
    RetryParams: &openfga.RetryParams{
        MaxRetry:    3,
        MinWaitInMs: 250,
    },
})
```

### Best Practices

- **Initialize once:** Create the client once and reuse throughout your application
- **Use context:** Always pass `context.Context` for cancellation and timeouts
- **Pointer helpers:** Use `openfga.PtrString()` for optional string parameters
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Streaming:** Use `StreamedListObjects` for large result sets

### 7.3 Python SDK

**Impact: HIGH (client implementation for Python)**

The `openfga_sdk` package provides the official OpenFGA client for Python applications with both async and sync support.

### Installation

```bash
pip install openfga_sdk
```

### Client Initialization

**Async client (recommended):**

```python
from openfga_sdk import ClientConfiguration, OpenFgaClient

async def main():
    configuration = ClientConfiguration(
        api_url="http://localhost:8080",
        store_id="YOUR_STORE_ID",
        authorization_model_id="YOUR_MODEL_ID"
    )
    async with OpenFgaClient(configuration) as fga_client:
        result = await fga_client.check(body)
        return result
```

**Synchronous client:**

```python
from openfga_sdk.client import ClientConfiguration
from openfga_sdk.sync import OpenFgaClient

def main():
    configuration = ClientConfiguration(
        api_url="http://localhost:8080",
        store_id="YOUR_STORE_ID"
    )
    with OpenFgaClient(configuration) as fga_client:
        result = fga_client.check(body)
        return result
```

**With API Token:**

```python
from openfga_sdk.credentials import Credentials, CredentialConfiguration

configuration = ClientConfiguration(
    api_url="http://localhost:8080",
    credentials=Credentials(
        method='api_token',
        configuration=CredentialConfiguration(
            api_token="YOUR_TOKEN"
        )
    )
)
```

**With Client Credentials (OAuth2):**

```python
configuration = ClientConfiguration(
    api_url="http://localhost:8080",
    credentials=Credentials(
        method='client_credentials',
        configuration=CredentialConfiguration(
            api_issuer="YOUR_ISSUER",
            api_audience="YOUR_AUDIENCE",
            client_id="YOUR_CLIENT_ID",
            client_secret="YOUR_CLIENT_SECRET"
        )
    )
)
```

### Load Authorization Model from File

**From JSON file:**

```python
import json
from openfga_sdk import WriteAuthorizationModelRequest

# Read JSON file
with open('model.json', 'r') as f:
    model_json = json.load(f)

# Create request from JSON
body = WriteAuthorizationModelRequest(
    schema_version=model_json.get('schema_version', '1.1'),
    type_definitions=model_json['type_definitions'],
    conditions=model_json.get('conditions')
)

response = await fga_client.write_authorization_model(body)
# response.authorization_model_id contains the new model ID
```

**From DSL (.fga) file:**

The Python SDK does not include a built-in DSL parser. Convert DSL files to JSON using the OpenFGA CLI, then load the JSON file.

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```python
from openfga_sdk.client.models import ClientCheckRequest

body = ClientCheckRequest(
    user="user:anne",
    relation="viewer",
    object="document:roadmap",
)

response = await fga_client.check(body)
# response.allowed = True/False
```

### Batch Check

```python
from openfga_sdk.client.models import (
    ClientBatchCheckItem,
    ClientBatchCheckRequest
)

checks = [
    ClientBatchCheckItem(
        user="user:anne",
        relation="viewer",
        object="document:roadmap"
    ),
    ClientBatchCheckItem(
        user="user:bob",
        relation="editor",
        object="document:budget"
    )
]

response = await fga_client.batch_check(
    ClientBatchCheckRequest(checks=checks)
)
```

### Write Tuples

```python
from openfga_sdk.client.models import ClientTuple, ClientWriteRequest

body = ClientWriteRequest(
    writes=[
        ClientTuple(
            user="user:anne",
            relation="viewer",
            object="document:roadmap"
        )
    ],
    deletes=[
        ClientTuple(
            user="user:bob",
            relation="editor",
            object="document:budget"
        )
    ]
)

response = await fga_client.write(body)
```

### List Objects

```python
from openfga_sdk.client.models import ClientListObjectsRequest

body = ClientListObjectsRequest(
    user="user:anne",
    relation="viewer",
    type="document"
)

response = await fga_client.list_objects(body)
# response.objects = ["document:roadmap", "document:budget"]
```

### Stream List Objects

```python
request = ClientListObjectsRequest(
    user="user:anne",
    relation="viewer",
    type="document"
)

results = []
async for response in fga_client.streamed_list_objects(request):
    results.append(response.object)
```

### List Relations

```python
from openfga_sdk.client.models import ClientListRelationsRequest

body = ClientListRelationsRequest(
    user="user:anne",
    object="document:roadmap",
    relations=["can_view", "can_edit"]
)

response = await fga_client.list_relations(body)
# response.relations = ["can_view"]
```

### List Users

```python
from openfga_sdk.client.models import ClientListUsersRequest, UserTypeFilter
from openfga_sdk.models.fga_object import FgaObject

request = ClientListUsersRequest(
    object=FgaObject(type="document", id="roadmap"),
    relation="can_read",
    user_filters=[
        UserTypeFilter(type="user"),
        UserTypeFilter(type="team", relation="member")
    ]
)

response = await fga_client.list_users(request)
```

### Read Tuples

```python
from openfga_sdk import ReadRequestTupleKey

body = ReadRequestTupleKey(
    user="user:anne",
    relation="viewer",
    object="document:roadmap"
)

response = await fga_client.read(body)
# response.tuples = [Tuple(...), ...]
```

### Non-Transaction Write Mode

```python
from openfga_sdk.client.models import WriteTransactionOpts

options = {
    "transaction": WriteTransactionOpts(
        disabled=True,
        max_parallel_requests=10,
        max_per_chunk=100
    )
}

response = await fga_client.write(body, options)
```

### Handle Write Conflicts

```python
from openfga_sdk.client.models.write_conflict_opts import (
    ConflictOptions,
    ClientWriteRequestOnDuplicateWrites,
    ClientWriteRequestOnMissingDeletes
)

options = {
    "conflict": ConflictOptions(
        on_duplicate_writes=ClientWriteRequestOnDuplicateWrites.IGNORE,
        on_missing_deletes=ClientWriteRequestOnMissingDeletes.IGNORE
    )
}

response = await fga_client.write(body, options)
```

### Retry Configuration

```python
from openfga_sdk.configuration import RetryParams

config = ClientConfiguration(
    api_url="http://localhost:8080",
    retry_params=RetryParams(
        max_retry=5,
        min_wait_in_ms=250
    )
)
```

### Error Handling

```python
from openfga_sdk.exceptions import ApiException

try:
    await fga_client.check(request)
except ApiException as e:
    if e.is_validation_error():
        print(f"Validation error: {e.error_message}")
    elif e.is_retryable():
        print(f"Temporary error (Request: {e.request_id})")
    else:
        print(f"Error: {e}")
```

### Best Practices

- **Use async:** Prefer async client for better performance
- **Context manager:** Use `async with` or `with` for proper resource cleanup
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Streaming:** Use `streamed_list_objects` for large result sets

### 7.4 Java SDK

**Impact: HIGH (client implementation for Java)**

The OpenFGA Java SDK provides the official client for JVM applications. Requires Java 11+.

### Installation

**Maven:**

```xml
<dependency>
    <groupId>dev.openfga</groupId>
    <artifactId>openfga-sdk</artifactId>
    <version>0.7.0</version>
</dependency>
```

**Gradle:**

```groovy
implementation 'dev.openfga:openfga-sdk:0.7.0'
```

### Client Initialization

**Basic setup:**

```java
import dev.openfga.sdk.api.client.OpenFgaClient;
import dev.openfga.sdk.api.configuration.ClientConfiguration;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .storeId(System.getenv("FGA_STORE_ID"))
        .authorizationModelId(System.getenv("FGA_MODEL_ID"));

var fgaClient = new OpenFgaClient(config);
```

**With API Token:**

```java
import dev.openfga.sdk.api.configuration.Credentials;
import dev.openfga.sdk.api.configuration.ApiToken;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .storeId(System.getenv("FGA_STORE_ID"))
        .credentials(new Credentials(
            new ApiToken(System.getenv("FGA_API_TOKEN"))));

var fgaClient = new OpenFgaClient(config);
```

**With Client Credentials (OAuth2):**

```java
import dev.openfga.sdk.api.configuration.ClientCredentials;

var config = new ClientConfiguration()
        .apiUrl(System.getenv("FGA_API_URL"))
        .credentials(new Credentials(
            new ClientCredentials()
                    .apiTokenIssuer(System.getenv("FGA_API_TOKEN_ISSUER"))
                    .apiAudience(System.getenv("FGA_API_AUDIENCE"))
                    .clientId(System.getenv("FGA_CLIENT_ID"))
                    .clientSecret(System.getenv("FGA_CLIENT_SECRET"))));

var fgaClient = new OpenFgaClient(config);
```

### Load Authorization Model from File

**From JSON file:**

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.openfga.sdk.api.model.WriteAuthorizationModelRequest;
import java.io.File;

ObjectMapper mapper = new ObjectMapper();

// Read and parse JSON file
WriteAuthorizationModelRequest body = mapper.readValue(
    new File("model.json"),
    WriteAuthorizationModelRequest.class
);

var response = fgaClient.writeAuthorizationModel(body).get();
// response.getAuthorizationModelId() contains the new model ID
```

**From DSL (.fga) file:**

Use the `openfga-language` package to transform DSL to JSON.

**Maven:**

```xml
<dependency>
    <groupId>dev.openfga</groupId>
    <artifactId>openfga-language</artifactId>
    <version>0.2.0</version>
</dependency>
```

**Gradle:**

```groovy
implementation 'dev.openfga:openfga-language:0.2.0'
```

**Transform DSL to JSON:**

```java
import dev.openfga.language.DslToJsonTransformer;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.openfga.sdk.api.model.WriteAuthorizationModelRequest;
import java.nio.file.Files;
import java.nio.file.Path;

// Read DSL file
String dslContent = Files.readString(Path.of("model.fga"));

// Transform DSL to JSON
String jsonString = new DslToJsonTransformer().transform(dslContent);

// Parse JSON into request body
ObjectMapper mapper = new ObjectMapper();
WriteAuthorizationModelRequest body = mapper.readValue(
    jsonString,
    WriteAuthorizationModelRequest.class
);

var response = fgaClient.writeAuthorizationModel(body).get();
// response.getAuthorizationModelId() contains the new model ID
```

**Validate DSL before transforming:**

```java
import dev.openfga.language.validation.ModelValidator;
import dev.openfga.language.errors.DslErrorsException;

try {
    ModelValidator.validateDsl(dslContent);
} catch (DslErrorsException e) {
    // Handle validation errors
    System.err.println("DSL errors: " + e.getErrors());
}
```

**Alternative: Use CLI for conversion**

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```java
import dev.openfga.sdk.api.client.model.ClientCheckRequest;

var request = new ClientCheckRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap");

var response = fgaClient.check(request).get();
// response.getAllowed() returns true/false
```

### Batch Check

```java
import dev.openfga.sdk.api.client.model.ClientBatchCheckRequest;
import dev.openfga.sdk.api.client.model.ClientBatchCheckItem;

var request = new ClientBatchCheckRequest().checks(
    List.of(
        new ClientBatchCheckItem()
            .user("user:anne")
            .relation("viewer")
            ._object("document:roadmap")
            .correlationId("check-1"),
        new ClientBatchCheckItem()
            .user("user:bob")
            .relation("editor")
            ._object("document:budget")
            .correlationId("check-2")));

var options = new ClientBatchCheckOptions()
    .maxParallelRequests(5)
    .maxBatchSize(20);

var response = fgaClient.batchCheck(request, options).get();
```

### Write Tuples

```java
import dev.openfga.sdk.api.client.model.ClientWriteRequest;
import dev.openfga.sdk.api.model.TupleKey;

var request = new ClientWriteRequest()
    .writes(List.of(
        new TupleKey()
            .user("user:anne")
            .relation("viewer")
            ._object("document:roadmap")))
    .deletes(List.of(
        new TupleKey()
            .user("user:bob")
            .relation("editor")
            ._object("document:budget")));

var response = fgaClient.write(request).get();
```

### List Objects

```java
import dev.openfga.sdk.api.client.model.ClientListObjectsRequest;

var request = new ClientListObjectsRequest()
    .user("user:anne")
    .relation("viewer")
    .type("document");

var response = fgaClient.listObjects(request).get();
// response.getObjects() returns accessible document IDs
```

### List Relations

```java
import dev.openfga.sdk.api.client.model.ClientListRelationsRequest;

var request = new ClientListRelationsRequest()
    .user("user:anne")
    ._object("document:roadmap")
    .relations(List.of("can_view", "can_edit", "can_delete"));

var response = fgaClient.listRelations(request).get();
// response.getRelations() returns applicable relations
```

### List Users

```java
import dev.openfga.sdk.api.client.model.ClientListUsersRequest;
import dev.openfga.sdk.api.model.FgaObject;
import dev.openfga.sdk.api.model.UserTypeFilter;

var userFilters = new ArrayList<UserTypeFilter>() {{
    add(new UserTypeFilter().type("user"));
}};

var request = new ClientListUsersRequest()
    ._object(new FgaObject().type("document").id("roadmap"))
    .relation("can_read")
    .userFilters(userFilters);

var response = fgaClient.listUsers(request).get();
// response.getUsers() returns matching users
```

### Read Tuples

```java
import dev.openfga.sdk.api.client.model.ClientReadRequest;

var request = new ClientReadRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap");

var response = fgaClient.read(request).get();
```

### Non-Transaction Write Mode

```java
var options = new ClientWriteOptions()
    .disableTransactions(true)
    .transactionChunkSize(100);

var response = fgaClient.write(request, options).get();
```

### Handle Write Conflicts

```java
import dev.openfga.sdk.api.model.WriteRequestWrites;
import dev.openfga.sdk.api.model.WriteRequestDeletes;

var options = new ClientWriteOptions()
    .onDuplicate(WriteRequestWrites.OnDuplicateEnum.IGNORE)
    .onMissing(WriteRequestDeletes.OnMissingEnum.IGNORE);

var response = fgaClient.write(request, options).get();
```

### Contextual Tuples

```java
var request = new ClientCheckRequest()
    .user("user:anne")
    .relation("viewer")
    ._object("document:roadmap")
    .contextualTuples(List.of(
        new ClientTupleKey()
            .user("user:anne")
            .relation("editor")
            ._object("document:roadmap")));

var response = fgaClient.check(request).get();
```

### Retry Configuration

```java
var config = new ClientConfiguration()
        .apiUrl("http://localhost:8080")
        .maxRetries(3)
        .minimumRetryDelay(Duration.ofMillis(250));

var fgaClient = new OpenFgaClient(config);
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Async handling:** Use `.get()` to block or `.thenApply()` for async
- **Object naming:** Use `._object()` (with underscore) for object parameter
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Java version:** Requires Java 11+

### 7.5 .NET SDK

**Impact: HIGH (client implementation for .NET)**

The `OpenFga.Sdk` package provides the official OpenFGA client for .NET applications.

### Installation

```powershell
dotnet add package OpenFga.Sdk
```

Supported frameworks: `net8.0`, `net9.0`, `netstandard2.0`, `net48`

### Client Initialization

**Basic setup:**

```csharp
using OpenFga.Sdk.Client;
using OpenFga.Sdk.Configuration;

var configuration = new ClientConfiguration() {
    ApiUrl = "http://localhost:8080",
    StoreId = Environment.GetEnvironmentVariable("FGA_STORE_ID"),
    AuthorizationModelId = Environment.GetEnvironmentVariable("FGA_MODEL_ID"),
};
var fgaClient = new OpenFgaClient(configuration);
```

**With API Token:**

```csharp
using OpenFga.Sdk.Configuration;

var configuration = new ClientConfiguration() {
    ApiUrl = Environment.GetEnvironmentVariable("FGA_API_URL"),
    StoreId = Environment.GetEnvironmentVariable("FGA_STORE_ID"),
    Credentials = new Credentials() {
        Method = CredentialsMethod.ApiToken,
        Config = new CredentialsConfig() {
            ApiToken = Environment.GetEnvironmentVariable("FGA_API_TOKEN"),
        }
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

**With Client Credentials (OAuth2):**

```csharp
var configuration = new ClientConfiguration() {
    ApiUrl = Environment.GetEnvironmentVariable("FGA_API_URL"),
    Credentials = new Credentials() {
        Method = CredentialsMethod.ClientCredentials,
        Config = new CredentialsConfig() {
            ApiTokenIssuer = Environment.GetEnvironmentVariable("FGA_API_TOKEN_ISSUER"),
            ApiAudience = Environment.GetEnvironmentVariable("FGA_API_AUDIENCE"),
            ClientId = Environment.GetEnvironmentVariable("FGA_CLIENT_ID"),
            ClientSecret = Environment.GetEnvironmentVariable("FGA_CLIENT_SECRET"),
        }
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

### Load Authorization Model from File

**From JSON file:**

```csharp
using System.Text.Json;
using OpenFga.Sdk.Model;

// Read and parse JSON file
var jsonContent = await File.ReadAllTextAsync("model.json");
var modelJson = JsonSerializer.Deserialize<WriteAuthorizationModelRequest>(jsonContent);

var response = await fgaClient.WriteAuthorizationModel(modelJson);
// response.AuthorizationModelId contains the new model ID
```

**From DSL (.fga) file:**

The .NET SDK does not include a built-in DSL parser. Convert DSL files to JSON using the OpenFGA CLI, then load the JSON file.

```bash
# Convert DSL to JSON using the FGA CLI
fga model transform --input model.fga --output model.json
```

Then load the JSON file as shown above.

### Check Permission

```csharp
using OpenFga.Sdk.Client.Model;

var body = new ClientCheckRequest {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap"
};
var response = await fgaClient.Check(body);
// response.Allowed = true/false
```

### Batch Check

```csharp
var options = new ClientBatchCheckOptions {
    MaxParallelRequests = 5,
    MaxBatchSize = 20,
};
var body = new ClientBatchCheckRequest {
    Checks = new List<ClientBatchCheckItem>() {
        new() {
            User = "user:anne",
            Relation = "viewer",
            Object = "document:roadmap",
            CorrelationId = "check-1",
        },
        new() {
            User = "user:bob",
            Relation = "editor",
            Object = "document:budget",
            CorrelationId = "check-2",
        }
    }
};
var response = await fgaClient.BatchCheck(body, options);
```

### Write Tuples

```csharp
var body = new ClientWriteRequest() {
    Writes = new List<ClientTupleKey> {
        new() {
            User = "user:anne",
            Relation = "viewer",
            Object = "document:roadmap",
        }
    },
    Deletes = new List<ClientTupleKeyWithoutCondition> {
        new() {
            User = "user:bob",
            Relation = "editor",
            Object = "document:budget",
        }
    },
};
var response = await fgaClient.Write(body);
```

### List Objects

```csharp
var body = new ClientListObjectsRequest {
    User = "user:anne",
    Relation = "viewer",
    Type = "document",
};
var response = await fgaClient.ListObjects(body);
// response.Objects contains accessible document IDs
```

### Streamed List Objects

```csharp
var options = new ClientListObjectsOptions {
    Consistency = ConsistencyPreference.HIGHERCONSISTENCY
};

var objects = new List<string>();
await foreach (var response in fgaClient.StreamedListObjects(
    new ClientListObjectsRequest {
        User = "user:anne",
        Relation = "can_read",
        Type = "document"
    },
    options)) {
    objects.Add(response.Object);
}
```

### List Relations

```csharp
var body = new ClientListRelationsRequest() {
    User = "user:anne",
    Object = "document:roadmap",
    Relations = new List<string> {"can_view", "can_edit", "can_delete"},
};
var response = await fgaClient.ListRelations(body);
// response.Relations contains applicable relations
```

### List Users

```csharp
using OpenFga.Sdk.Model;

var body = new ClientListUsersRequest() {
    Object = new FgaObject() {
        Type = "document",
        Id = "roadmap"
    },
    Relation = "can_read",
    UserFilters = new List<UserTypeFilter> {
        new() { Type = "user" }
    },
};
var response = await fgaClient.ListUsers(body);
```

### Read Tuples

```csharp
var body = new ClientReadRequest() {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap",
};
var response = await fgaClient.Read(body);
```

### Non-Transaction Write Mode

```csharp
var options = new ClientWriteOptions {
    Transaction = new TransactionOptions() {
        Disable = true,
        MaxParallelRequests = 5,
        MaxPerChunk = 100,
    }
};
var response = await fgaClient.Write(body, options);
```

### Handle Write Conflicts

```csharp
var options = new ClientWriteOptions {
    Conflict = new ConflictOptions {
        OnDuplicateWrites = OnDuplicateWrites.Ignore,
        OnMissingDeletes = OnMissingDeletes.Ignore
    }
};
var response = await fgaClient.Write(body, options);
```

### Contextual Tuples

```csharp
var body = new ClientCheckRequest {
    User = "user:anne",
    Relation = "viewer",
    Object = "document:roadmap",
    ContextualTuples = new List<ClientTupleKey> {
        new() {
            User = "user:anne",
            Relation = "editor",
            Object = "document:roadmap",
        },
    },
};
var response = await fgaClient.Check(body);
```

### Retry Configuration

```csharp
var configuration = new ClientConfiguration() {
    ApiUrl = "http://localhost:8080",
    RetryParams = new RetryParams() {
        MaxRetry = 3,
        MinWaitInMs = 250
    }
};
var fgaClient = new OpenFgaClient(configuration);
```

### Per-Request Headers

```csharp
var options = new ClientCheckOptions {
    Headers = new Dictionary<string, string> {
        { "X-Request-ID", "123e4567-e89b-12d3-a456-426614174000" }
    }
};
var response = await fgaClient.Check(body, options);
```

### Best Practices

- **Initialize once:** Create `OpenFgaClient` once and reuse throughout your application
- **Async/await:** All methods are async - use `await` properly
- **Streaming:** Use `StreamedListObjects` with `await foreach` for large result sets
- **Retry behavior:** SDK auto-retries on 429 and 5xx errors (up to 3 times)
- **Retry-After:** SDK respects the `Retry-After` header with exponential backoff

---
## 8. Workflow

**Impact: CRITICAL**

Essential workflow practices for working with OpenFGA models.

### 8.1 Always Validate Models

**Impact: CRITICAL (mandatory workflow step)**

**CRITICAL**: After creating or modifying any `.fga` or `.fga.yaml` file, you MUST immediately run tests to validate the model. Never deliver an untested model.

### Incorrect: Delivering Untested Model

```
1. Create/modify .fga model
2. Create/modify .fga.yaml tests
3. Deliver to user ❌ WRONG
```

The model may have syntax errors, logical errors, or test assertions that don't match actual behavior.

### Correct: Validate Before Delivery

```
1. Create/modify .fga model
2. Create/modify .fga.yaml tests
3. Run: fga model test --tests <file>.fga.yaml ✓
4. If tests fail: fix model or tests, go to step 3
5. Deliver to user with test results ✓
```

### Command

```bash
fga model test --tests <filename>.fga.yaml
```

### Why This Matters

- **Syntax errors**: The DSL parser will catch invalid syntax
- **Logical errors**: Tests verify permissions work as intended
- **Inheritance bugs**: Complex `from` relationships may not behave as expected
- **Missing tuples**: Tests ensure all required tuples exist for assertions

### Example Workflow

```bash
# After creating notion.fga and notion.fga.yaml
$ fga model test --tests notion.fga.yaml

# Expected output for passing tests:
# Test Summary #
Tests 14/14 passing
Checks 123/123 passing
ListObjects 3/3 passing
ListUsers 1/1 passing

# If tests fail, fix the issues and re-run until all pass
```

### Non-Negotiable

This step is **not optional**. An untested authorization model may:
- Grant access to users who shouldn't have it
- Deny access to users who should have it
- Cause security vulnerabilities in production

Always run tests. Always report results to the user.

---
## References

1. [OpenFGA Documentation](https://openfga.dev/docs)
2. [OpenFGA DSL Reference](https://openfga.dev/docs/configuration-language)
3. [OpenFGA CLI](https://github.com/openfga/cli)
4. [OpenFGA Sample Stores](https://github.com/openfga/sample-stores)
5. [Google Zanzibar Paper](https://research.google/pubs/pub48190/)
