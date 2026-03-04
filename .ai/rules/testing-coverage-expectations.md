---
title: Test Coverage Expectations
description: Coverage targets are risk-tiered and behavior-focused. Prioritize branch coverage on critical logic, not vanity line-coverage metrics.
impact: HIGH
scope: all
tags: testing, coverage, quality, risk
---

## Test coverage expectations

Coverage targets vary by risk and test type. There is no single blanket percentage for the monorepo. Optimize for confidence in the workflows and risks that matter most, not for coverage numbers alone.

### Coverage by test type

**Unit tests:** Heavy use for pure logic, validation, permissions, scoring, calculations, and branching utilities.

| Code category | Target |
|---------------|--------|
| Critical pure logic (scoring, CAT, permissions) | 90%+ line coverage, high branch coverage |
| General domain/service logic | 75-85% |

Prefer **branch coverage** over raw line coverage for code with permissions, scoring, state transitions, or edge cases.

**Integration tests:** Primary source of confidence for APIs, database behavior, authorization, soft deletes, workflow orchestration, and external-data writes.
- Do not manage mainly by percentage
- Require explicit coverage for all critical workflows and sensitive authorization/data boundaries

**E2E tests:** Keep lean and high-value.
- Cover all major user journeys, not every permutation
- Prefer a small number of reliable end-to-end flows over broad brittle coverage
- No global percentage target

**Contract/regression tests:** Required for stable schemas, API contracts, scoring outputs, migrations, and reporting calculations.

### Risk tiers

| Tier | Examples | Expectation |
|------|----------|-------------|
| Highest | Scoring/CAT, auth/authz, student data isolation, assessment state persistence, rostering/sync, reporting correctness, soft-delete semantics | 85-90%+ with strong branch coverage |
| Medium | API controllers, service orchestration, dashboards, admin workflows | 75-85% |
| Lower | Presentational components, thin wrappers, low-risk glue code | 60-75%, higher for stateful/business logic |

### PR rule

Any PR that changes critical behavior must add tests at the layer where that behavior can fail:

| Change type | Required tests |
|-------------|---------------|
| Logic change | Unit/regression tests |
| DB/query/API change | Integration tests |
| User workflow change | E2E or high-value integration tests |
| Contract/schema change | Contract tests |

### Incorrect

```typescript
// PR adds a new permission check but no tests ("the existing tests cover it")
async function list(authContext: AuthContext, options: ListOptions) {
  if (!hasSupervisoryRole(userRoles)) {
    throw new ApiError(ApiErrorMessage.FORBIDDEN, { /* ... */ });
  }
  // ... rest of logic
}
// No test for the new supervisory role check
```

### Correct

```typescript
// PR adds the permission check AND a test for the new branch
it('returns 403 when user has only supervised roles', async () => {
  const service = ResourceService({ resourceRepository: mockRepository });
  const studentAuth = AuthContextFactory.build({ isSuperAdmin: false });
  mockRepository.getUserRolesForResource.mockResolvedValue([UserRole.STUDENT]);

  await expect(service.list(studentAuth, defaultOptions))
    .rejects.toThrow(ApiError);
});
```

### The principle

Coverage metrics are a tool, not a goal. A service with 100% line coverage but no branch coverage on the authorization path is less trustworthy than one with 80% coverage that tests every permission boundary. The risk tiers reflect what actually matters in an education platform: student data isolation, scoring correctness, and authorization are non-negotiable. Presentational components can tolerate a lighter touch.
