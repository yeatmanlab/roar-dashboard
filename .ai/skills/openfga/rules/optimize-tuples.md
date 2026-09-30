---
title: Minimize Tuple Count
impact: MEDIUM
impactDescription: storage and performance
tags: optimization, tuples, indirect-relations, scalability
---

## Minimize Tuple Count

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
