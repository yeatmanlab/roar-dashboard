---
title: When to Use Each Role Pattern
impact: MEDIUM
impactDescription: choosing the right pattern
tags: roles, patterns, decision-guide
---

## When to Use Each Role Pattern

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Simple Static Roles** | Organization-wide roles with consistent permissions | Simple, efficient | Less flexible for per-resource customization |
| **Simple Custom Roles** | Custom organization-wide roles with consistent permissions | Simple, efficient | Less flexible for per-resource customization |
| **Role Assignments** | Custom resource-specific roles with different members per resource | Highly flexible | More complex, more tuples |

**Choose Simple Roles when:**
- Roles apply at the organization level
- Same users have the role everywhere
- Permission structure is straightforward
- You want minimal tuple management

**Example:** Organization billing admin, HR manager

**Choose Custom Roles when:**
- You need to let end-users define their own roles at the organization level
- Same users have the role everywhere
- Permission structure is straightforward
- You want minimal tuple management

**Example:** End-users can create a billing admin or HR admin role

**Choose Role Assignments when:**
- You need to let end-users define their own roles at the organization level
- Different users need the same role on different resources
- Per-project or per-team role membership varies
- Fine-grained resource-level control is required
- Role membership changes frequently per resource

**Example:** Project lead (different for each project)

**Migration strategies when evolving roles:**

1. **Additive approach:** Introduce custom roles alongside existing static roles
2. **Gradual migration:** Move permissions one at a time to custom roles
3. **Backwards compatibility:** Maintain existing static role behavior during transition

**Common mistake:** Using role assignments for organization-level roles. This adds unnecessary complexity. Use simple user-defined roles instead.
