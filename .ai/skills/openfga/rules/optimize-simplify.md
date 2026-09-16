---
title: Simplify Models
impact: MEDIUM
impactDescription: maintainability
tags: optimization, simplify, cleanup, unused
---

## Simplify Models

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
