---
title: AI Agent Usage Guidelines
description: AI agents accelerate boilerplate and testing but require human review for authorization, access control queries, scoring logic, and student data boundaries.
impact: HIGH
scope: all
tags: ai, culture, security, authorization, review
---

## AI agent usage guidelines

AI coding agents are a force multiplier for the team. They're excellent at generating boilerplate, writing tests, and scaffolding new endpoints. But ROAR is an education platform handling student data with a complex authorization model, and these are the areas where AI agents are most likely to produce plausible-but-wrong code.

### Where AI agents excel

- **Boilerplate scaffolding:** New endpoint skeletons across all 5 layers (contract, route, controller, service, repository).
- **Test generation:** Unit test suites, integration test setup, factory creation.
- **Data transformation:** Controller transform functions, DTO mappings, response shaping.
- **Documentation:** JSDoc, inline comments, PR descriptions.
- **Repetitive refactoring:** Renaming, extracting helpers, standardizing patterns.
- **Code style fixes:** Applying conventions from these rules consistently.

### Where humans must review carefully

These areas require human sign-off even when AI-generated code looks correct:

**Authorization and access control (CRITICAL):**
- Access control subqueries in `repositories/access-controls/`. The ltree joins, UNION paths, and supervisory/descendant logic are too domain-specific for an agent to get right reliably.
- `rolesForPermission()` mappings. Which roles grant which permissions is a policy decision.
- Supervisory vs. supervised role checks. Agents frequently miss `hasSupervisoryRole()` guards or apply them in the wrong direction.
- Super admin bypass logic. Must be checked first in every authorization flow.

**Scoring, CAT, and assessment logic:**
- Score calculation, grade estimation, percentile mapping
- Adaptive testing (CAT) state transitions and item selection
- Any logic that produces student-facing results

**Student data isolation:**
- Queries that filter by org/class/group membership
- Any endpoint that returns student records or PII
- Soft-delete semantics. Ensure deleted records don't leak through.

**Database schema and migrations:**
- Schema changes to `apps/backend/src/db/schema/` or Drizzle schema files
- Migration SQL. Verify it's safe, reversible, and handles existing data.
- Trigger behavior (e.g., `prevent_rostered_entity_delete`, `orgs.path` auto-population)

### The workflow

For tasks in the "agents excel" category, let the agent work autonomously and review the output normally.

For tasks touching the "humans must review" areas:
1. Let the agent generate a first draft
2. Review every authorization check, access control query, and data boundary line by line
3. Verify against the schema and existing canonical implementations (see the reference implementations in [backend-layer-architecture](backend-layer-architecture.md))
4. Run integration tests to validate real database behavior. Unit test mocks can hide access control bugs.

### Incorrect

```
// Agent generates an endpoint, developer approves without checking auth
// The access control subquery is missing the descendant path for supervisory roles
// Students at School B can now see administrations they shouldn't have access to
```

### Correct

```
// Agent generates the endpoint scaffold and tests
// Developer reviews the access control subquery line-by-line:
//   - Are all 6 UNION paths present?
//   - Is the supervisory role filter correct?
//   - Does the integration test cover cross-org access denial?
// Developer runs integration tests against real DB before approving
```

### The principle

AI agents don't understand your authorization model. They pattern-match from examples. The ltree hierarchy, per-entity roles, and supervisory/supervised distinction are subtle enough that even experienced engineers make mistakes. Trust the agent for structure and boilerplate; verify the security boundaries yourself.
