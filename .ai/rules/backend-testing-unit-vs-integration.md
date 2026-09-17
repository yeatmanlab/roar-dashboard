---
title: Backend Testing — Unit vs Integration
description: Unit tests (.test.ts) mock dependencies and test a single layer. Integration tests (.integration.test.ts) use the real database, baseFixture, and factories.
impact: MEDIUM
scope: backend
tags: testing, vitest, unit-tests, integration-tests
---

## Backend testing — unit vs integration

Unit tests (`.test.ts`) isolate a single layer by mocking its dependencies. Integration tests (`.integration.test.ts`) run against a real database with seeded data. They live in separate Vitest projects with different configurations.

### Incorrect

```typescript
// Unit test hitting the real database — should mock the repository
it('returns administrations', async () => {
  const result = await service.list(authContext, { page: 1, perPage: 25 });
  expect(result.items).toHaveLength(3); // depends on DB state
});

// Integration test mocking the repository — defeats the purpose
vi.mock('../../repositories/administration.repository');
it('returns filtered results', async () => { /* ... */ });

// Inline mocks with as any — use the typed mock factories from test-support/ instead
const mockRepository = { getById: vi.fn(), listAll: vi.fn() };
const service = MyService({ repository: mockRepository as any });
```

### Correct — unit tests

**Controller tests** mock the service module with `vi.mock()` and re-import the controller via dynamic `import()` to pick up the mocks:

```typescript
vi.mock('../services/administration/administration.service');

const mockList = vi.fn();
vi.mocked(AdministrationService).mockReturnValue({ list: mockList });

const { AdministrationsController } = await import('./administrations.controller');

it('returns 200 with transformed items', async () => {
  mockList.mockResolvedValue({ items: [/* ... */], totalItems: 1 });
  const result = await AdministrationsController.list(mockAuthContext, query);
  const data = expectOkResponse(result);
  expect(data.items).toHaveLength(1);
});
```

**Service tests** inject mock dependencies via the service's constructor parameters, using the typed mock factories from `test-support/`:

```typescript
import { createMockAdministrationRepository } from '../../test-support/repositories';
import { createMockRunsService } from '../../test-support/services';

let mockRepository: ReturnType<typeof createMockAdministrationRepository>;
let mockRunsService: ReturnType<typeof createMockRunsService>;

beforeEach(() => {
  vi.resetAllMocks();
  mockRepository = createMockAdministrationRepository();
  mockRunsService = createMockRunsService();
});

const service = AdministrationService({
  administrationRepository: mockRepository,
  runsService: mockRunsService,
});
```

Reusable mock factories live in `test-support/repositories/` and `test-support/services/`. They return fully typed mocks (`MockedObject<T>`) so no `as any` cast is needed. When adding a new service or repository, create a corresponding mock factory rather than inlining mocks in each test file.

**All unit tests** call `vi.clearAllMocks()` in `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Logger** is mocked globally in `test-support/mocks/logger.mock.ts` (imported in `vitest.setup.ts`). Tests can assert on log calls:

```typescript
expect(logger.error).toHaveBeenCalledWith(
  expect.objectContaining({ err: error }),
  'Failed to retrieve resource',
);
```

### Correct — integration tests

Integration tests run against real databases (core + assessment). The lifecycle is:

1. `beforeAll` — initialize DB pools, truncate all tables, seed `baseFixture`
2. Tests run — use `baseFixture` (read-only) plus factories for test-specific data
3. `afterAll` — close connections

**`baseFixture`** provides a pre-seeded org hierarchy with users, administrations, tasks, and relationships:

```typescript
import { baseFixture } from '../test-support/fixtures';

it('returns administrations accessible to district admin', async () => {
  const result = await repo.listAuthorized(
    { userId: baseFixture.districtAdminA.id, allowedRoles: roles },
    { page: 1, perPage: 25 },
  );
  expect(result.items[0]!.id).toBe(baseFixture.administrationAtDistrictA.id);
});
```

**Factories** create test-specific data that goes beyond what `baseFixture` provides:

```typescript
const admin = await AdministrationFactory.create({
  createdBy: baseFixture.districtAdminA.id,
});
await AdministrationOrgFactory.create({
  administrationId: admin.id,
  orgId: baseFixture.districtA.id,
});
```

**Non-null assertions** (`!`) are expected on array indexing and nullable fields — `noUncheckedIndexedAccess` is enabled in tsconfig.

### Route integration tests

Route-level integration tests use the helpers in `test-support/route-test.helper.ts` for full HTTP stack testing:

```typescript
let app: Express;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;

beforeAll(async () => {
  const { registerAdministrationsRoutes } = await import('./administrations');
  app = createTestApp(registerAdministrationsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.districtA.id);
});

it('admin can list administrations', async () => {
  const res = await expectRoute('GET', '/v1/administrations')
    .as(tiers.admin)
    .toReturn(200);
  expect(res.body.data.items).toBeInstanceOf(Array);
});

it('returns 401 without auth', async () => {
  await expectRoute('GET', '/v1/administrations')
    .unauthenticated()
    .toReturn(401);
});
```

Key helpers:
- **`createTestApp(registerRoutes)`** — creates an Express app with the given routes under `/v1`
- **`createRouteHelper(app)`** — fluent API for making authenticated requests (`.as(user)`, `.unauthenticated()`, `.toReturn(status)`)
- **`createTierUsers(orgId)`** — creates one user per permission tier (superAdmin, siteAdmin, admin, educator, student, caregiver) at the given org

### The principle

Unit tests verify logic in isolation — authorization branching, error mapping, data transformation. Integration tests verify that layers work together against real data — SQL correctness, access control filtering, pagination. Keeping them separate means unit tests stay fast (no DB) and integration tests stay reliable (no mocks hiding real behavior).
