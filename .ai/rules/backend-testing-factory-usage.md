---
title: Backend Testing — Factory Usage
description: When to use build() vs create(), how baseFixture and factories work together, and where to find the available factories.
impact: MEDIUM
scope: backend
tags: testing, factories, fixtures, fishery
---

## Backend testing — factory usage

Test data is created with Fishery factories (`Factory.define()`). Use `build()` for in-memory objects in unit tests and `create()` for database-persisted records in integration tests. `baseFixture` provides the shared org hierarchy — treat it as read-only and use factories for test-specific data.

### Incorrect

```typescript
// Hardcoding test data instead of using factories
const user = { id: 'abc-123', nameFirst: 'Test', nameLast: 'User', /* ... 20 more fields */ };

// Mutating baseFixture data — it's shared across all tests in the file
baseFixture.districtAdminA.nameFirst = 'Modified';

// Using create() in unit tests — unit tests shouldn't touch the database
const user = await UserFactory.create({ nameFirst: 'Test' });
const service = UserService({ userRepository: mockRepo });
```

### Correct

**`build()` — in-memory objects for unit tests:**

```typescript
const user = UserFactory.build({ nameFirst: 'Test' });
const admin = AdministrationFactory.build();
const authContext = AuthContextFactory.build({ isSuperAdmin: true });
```

Override only the fields your test cares about — factories provide sensible defaults for everything else.

**`create()` — persisted records for integration tests:**

```typescript
const admin = await AdministrationFactory.create({
  createdBy: baseFixture.districtAdminA.id,
});

// Create relationships via junction factories
await AdministrationOrgFactory.create({
  administrationId: admin.id,
  orgId: baseFixture.districtA.id,
});
```

**`buildList()` / `createList()` — multiple records:**

```typescript
const users = UserFactory.buildList(5);
const orgs = await OrgFactory.createList(3);
```

### Factories

All factories live in `test-support/factories/` and fall into three categories:

- **Entity factories** (e.g., `UserFactory`, `OrgFactory`, `AdministrationFactory`) — create domain objects. Some have constraints: `AdministrationFactory.create()` requires `createdBy`, `OrgFactory` has its `path` set by a DB trigger (don't set manually), and users can't be deleted (DB trigger `prevent_rostered_entity_delete`).
- **Junction factories** (e.g., `UserOrgFactory`, `AdministrationOrgFactory`) — create relationships between entities.
- **Auth factories** (e.g., `AuthContextFactory`, `DecodedUserFactory`) — create auth-related objects. Always `build()`, never persisted.

Check `test-support/factories/index.ts` for the full list of available factories.

### baseFixture

`baseFixture` is seeded once per test file in `beforeAll`. It provides:

- **Org hierarchy**: Districts, schools, and classes with ltree paths
- **Users**: District admins, school teachers, students at various levels
- **Administrations**: Assigned at district, school, class, and group levels
- **Tasks and variants**: With grade and ELL conditions
- **All junction relationships** pre-configured

Access fixture data by name:

```typescript
baseFixture.districtA                    // Org record
baseFixture.districtAdminA               // User record
baseFixture.administrationAtDistrictA    // Administration record
```

When a test needs data that doesn't exist in `baseFixture`, create it with factories. Don't mutate `baseFixture` at runtime — other tests in the same file depend on it. The fixture definition itself can be extended when a change benefits tests across the board (e.g., adding a new user role or org level), since its goal is to represent a realistic base data structure.

### The principle

Factories keep tests focused on what they're testing, not on constructing valid test objects. `build()` gives you a valid object shape without database overhead. `create()` gives you a real record with auto-generated IDs, timestamps, and DB trigger side effects. `baseFixture` provides the shared context that most tests need (org hierarchy, users, relationships) so each test only has to set up what's unique to its scenario.
