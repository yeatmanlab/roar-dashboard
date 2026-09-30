---
title: Conditional Relationships
impact: MEDIUM
impactDescription: dynamic authorization
tags: relations, conditions, cel, contextual
---

## Conditional Relationships

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
