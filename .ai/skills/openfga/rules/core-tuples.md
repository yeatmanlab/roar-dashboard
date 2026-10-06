---
title: Relationship Tuples as Facts
impact: CRITICAL
impactDescription: model vs data
tags: core, tuples, data, facts
---

## Relationship Tuples as Facts

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
