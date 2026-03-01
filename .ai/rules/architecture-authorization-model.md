---
title: Authorization Model
description: How our authorization model works — per-entity roles, org hierarchy via ltree, and the supervisory/supervised distinction.
impact: CRITICAL
scope: all
tags: authorization, rbac, security, architecture, ltree, roles, oneroster
---

## Authorization model

Understanding the authorization model is essential to implementing any feature that touches access control — backend endpoints, frontend permission checks, API design, and database schema changes.

### Org hierarchy and ltree

The entity hierarchy is district > school > class, with groups as a flat structure alongside it. Organizations (districts, schools) and classes store materialized paths using PostgreSQL's `ltree` extension (`orgs.path` and `classes.orgPath`), enabling efficient ancestor/descendant queries without recursive CTEs. For example, a school's path `district_abc.school_def` lets a query find all ancestor or descendant entities in a single `ltree` operator call.

### Roles are per-entity, not global

A user's role is defined on each junction table (`user_orgs`, `user_classes`, `user_groups`), not on the user record. The same user can be a `teacher` at one school and an `administrator` at a district. Authorization queries must join against these junction tables to determine what role(s) a user has for a specific resource.

### Roles vs. super admin

Roles, issued from the `user_role` enum are based on OneRoster v1.1/v1.2 and are checked via junction table membership. Super admin capability is a separate `isSuperAdmin` flag on the user record that bypasses all role-based checks entirely — it's checked first in every authorization flow.

### Supervisory vs. supervised roles

Roles are classified in `constants/role-classifications.ts`:
- **Supervisory** (`SUPERVISORY_ROLES`): e.g., `administrator`, `teacher` — can see resources on their own entity, ancestor entities, *and* descendant entities (e.g., a district admin sees both the district's parent and its child schools/classes)
- **Supervised** (`SUPERVISED_ROLES`): e.g., `student`, `guardian` — can only see resources on their own entity and ancestor entities that cascade down; no visibility into descendants or siblings

The utility `hasSupervisoryRole(roles)` is used to check a user's role classification.

### Two-layer authorization

Every authorization check involves two questions:

1. **Permission check:** Does the user's role(s) grant this permission? Use `rolesForPermission()` to check which role(s) the user needs for the action (e.g., `Permissions.Resource.READ`).
2. **Resource access check:** Can the user access this specific resource? Use access control subqueries in `repositories/access-controls/` that join against org/class/group membership and ltree paths to determine if the user has the required role on an entity.

### The principle

Authorization is the most complex part of the ROAR platform. The combination of per-entity roles, hierarchical org trees, and supervisory/supervised classification means there is no simple "check if user is admin" shortcut. Every authorization decision requires understanding which entity the user is accessing, what role they hold on that entity (or its ancestors/descendants), and whether that role grants the required permission. Getting any of these wrong is a security vulnerability.
