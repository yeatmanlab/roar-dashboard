---
title: List Objects Tests
impact: MEDIUM
impactDescription: verify object enumeration
tags: testing, list-objects, enumeration
---

## List Objects Tests

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
