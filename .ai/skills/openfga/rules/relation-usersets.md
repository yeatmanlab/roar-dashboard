---
title: Usersets for Group-Based Access
impact: HIGH
impactDescription: efficient group management
tags: relations, usersets, groups, teams
---

## Usersets for Group-Based Access

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
