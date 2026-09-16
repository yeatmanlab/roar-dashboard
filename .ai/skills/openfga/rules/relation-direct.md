---
title: Direct Relationships
impact: CRITICAL
impactDescription: explicit access grants
tags: relations, direct, type-restrictions, tuples
---

## Direct Relationships

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
