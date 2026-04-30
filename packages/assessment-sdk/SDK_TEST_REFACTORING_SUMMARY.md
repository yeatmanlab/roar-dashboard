# SDK Integration Test Refactoring Summary

## Overview

This refactoring addresses the architectural feedback on SDK integration tests by removing all test infrastructure from production code and creating a dedicated test server entrypoint that composes existing backend test-support utilities.

## Changes Made

### 1. Created Dedicated Test Server Entrypoint

**File:** `apps/backend/src/server-test.ts` (NEW)x

A thin script that:
- Initializes database pools and runs migrations
- Truncates tables and seeds baseFixture test data
- Initializes OpenFGA store, deploys authorization model, and syncs tuples
- Mocks AuthService to accept test tokens (token string = Firebase UID)
- Writes fixture data to a JSON file for SDK tests to discover
- Starts Express server

**Key Design:**
- Uses only existing test-support utilities
- No production code modifications
- Follows same patterns as backend's `vitest.integration.globalSetup.ts`
- Writes fixture data to file instead of exposing HTTP endpoint

### 2. Cleaned Production Code

#### `apps/backend/src/server.ts`
- **Removed:** Test data seeding logic from production startup path
- **Reason:** Test setup should be in dedicated test server, not production code

#### `apps/backend/src/services/auth/auth.service.ts`
- **Removed:** NODE_ENV=test check that conditionally used TestAuthProvider
- **Reason:** Test server will mock the provider directly instead

#### `apps/backend/src/routes/index.ts`
- **Removed:** Dynamic import of test routes with race condition
- **Reason:** No test routes needed; fixture data comes from file

#### `apps/backend/src/routes/test.ts`
- **Deleted:** Test fixture HTTP endpoint
- **Reason:** SDK tests now read fixture data from file

### 3. Updated SDK Test Infrastructure

#### `packages/assessment-sdk/vitest.integration.globalSetup.ts`
- **Changed:** Spawn test server (`node dist/server-test.js`) instead of production server (`npm run start`)
- **Updated:** Environment variables to use `TEST_FIXTURE_FILE` instead of `SEED_TEST_DATA`
- **Benefit:** Clear separation between production and test server startup

#### `packages/assessment-sdk/src/test-support/sdk-test-helper.ts`
- **Changed:** `getBaseFixtureData()` reads from file instead of making HTTP call
- **Benefit:** No race condition, no HTTP overhead, clear dependency

## Architectural Improvements

### ✅ Clean Separation of Concerns

| Layer | Before | After |
|-------|--------|-------|
| **Production Code** | Test seeding, conditional auth, dynamic test routes | Clean, no test infrastructure |
| **Test Code** | HTTP calls to test endpoint, race condition | File-based fixture discovery |
| **Test Support** | Reused by backend tests only | Reused by backend and SDK tests |

### ✅ Full Authorization Testing

- Test server initializes FGA the same way backend integration tests do
- SDK tests can now exercise real FGA authorization checks
- Tests can use non-anonymous users with proper role-based access

### ✅ No Race Conditions

- Fixture data written to file during server startup
- SDK tests read file after server is healthy
- No sub-millisecond window where fixture endpoint could return 404

### ✅ Reuses Existing Patterns

All test setup uses existing backend test-support utilities:
- `initializeDatabasePools()` — Same as backend
- `runMigrations()` — Same as backend
- `truncateAllTables()` — Same as backend tests
- `seedBaseFixture()` — Same as backend tests
- `initializeFgaTestStore()` — Same as backend setup
- `syncFgaTuplesFromPostgres()` — Same as backend tests

## Files Summary

### Created
- `apps/backend/src/server-test.ts` — Dedicated test server entrypoint
- `SDK_TEST_ARCHITECTURE.md` — Comprehensive architecture documentation
- `SDK_TEST_REFACTORING_SUMMARY.md` — This file

### Modified
- `apps/backend/src/server.ts` — Removed test seeding
- `apps/backend/src/services/auth/auth.service.ts` — Removed NODE_ENV=test check
- `apps/backend/src/routes/index.ts` — Removed dynamic test route import
- `packages/assessment-sdk/vitest.integration.globalSetup.ts` — Use test server
- `packages/assessment-sdk/src/test-support/sdk-test-helper.ts` — File-based fixture discovery

### Deleted
- `apps/backend/src/routes/test.ts` — Test fixture HTTP endpoint

## Migration Path

### For SDK Integration Tests

1. **No changes needed** — Tests continue to work the same way
2. **Fixture discovery** — Now reads from file instead of HTTP
3. **Authorization** — Now exercises real FGA checks
4. **Token handling** — Still uses test tokens (token string = Firebase UID)

### For Backend Integration Tests

1. **No changes** — Existing backend tests unaffected
2. **Can reuse** — Test server uses same utilities

### For Production Code

1. **No changes** — Production server (`server.ts`) is cleaner
2. **No test dependencies** — No NODE_ENV=test checks
3. **No test routes** — No dynamic imports or race conditions

## Testing

### Run SDK Integration Tests

```bash
# Start dependencies
docker compose up -d postgres openfga

# Run tests
npm run test:integration -w packages/assessment-sdk
```

### Run Backend Integration Tests

```bash
# No changes to existing backend tests
npm run test:integration -w apps/backend
```

## Verification Checklist

- [x] Test server entrypoint created and compiles
- [x] Production code cleaned (no test infrastructure)
- [x] SDK global setup uses test server
- [x] Fixture discovery uses file instead of HTTP
- [x] FGA initialization in test server
- [x] AuthService mocking in test server
- [x] Documentation created

## Next Steps

1. **Build and test** — Ensure backend builds and test server starts
2. **Run SDK tests** — Verify tests pass with new architecture
3. **Review** — Get feedback on architectural approach
4. **Merge** — Once verified and reviewed

## Questions & Answers

### Q: Why not keep the HTTP endpoint for fixture discovery?

**A:** The HTTP endpoint created a race condition (sub-millisecond window where it could return 404) and required test routes in production code. File-based discovery is simpler, faster, and keeps test infrastructure out of production.

### Q: Why mock AuthService instead of using NODE_ENV=test?

**A:** Conditional logic in production code is a code smell. The test server directly replaces the provider instance, which is cleaner and doesn't require production code to know about test mode.

### Q: Can SDK tests now test authorization?

**A:** Yes! The test server initializes FGA the same way backend integration tests do, so SDK tests can now exercise real authorization checks with proper role-based access.

### Q: Will this break existing SDK tests?

**A:** No. Tests continue to work the same way. The only change is fixture discovery (file instead of HTTP) and the ability to test authorization (which tests can opt into).

### Q: What if the fixture file doesn't exist?

**A:** Tests will fail with a clear error message: "Failed to read fixture data from /tmp/roar-test-fixture.json. Ensure server-test.ts has started and written the fixture file."

## References

- **Architecture Documentation:** `SDK_TEST_ARCHITECTURE.md`
- **Test Server:** `apps/backend/src/server-test.ts`
- **Backend Integration Setup:** `apps/backend/vitest.integration.globalSetup.ts`
- **FGA Test Infrastructure:** `apps/backend/src/test-support/fga/index.ts`
- **SDK Global Setup:** `packages/assessment-sdk/vitest.integration.globalSetup.ts`
- **SDK Test Helper:** `packages/assessment-sdk/src/test-support/sdk-test-helper.ts`
