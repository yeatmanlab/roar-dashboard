---
title: Check Assertions
impact: HIGH
impactDescription: verify permission grants
tags: testing, check, assertions, permissions
---

## Check Assertions

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
