---
title: List Users Tests
impact: MEDIUM
impactDescription: verify user enumeration
tags: testing, list-users, enumeration
---

## List Users Tests

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
