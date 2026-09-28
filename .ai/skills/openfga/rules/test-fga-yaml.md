---
title: Structure Tests in .fga.yaml
impact: HIGH
impactDescription: test-driven authorization
tags: testing, fga-yaml, structure, validation
---

## Structure Tests in .fga.yaml

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
