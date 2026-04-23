# Assessment SDK Integration Tests

This document describes the integration test infrastructure for the Assessment SDK, which validates SDK behavior against a real backend running on test databases.

## Overview

Integration tests run the SDK against a locally spawned backend server that connects to test databases. This validates:

- **Request/response shapes** - Ensures API contracts are correct
- **Error mapping** - Validates error handling and status codes
- **End-to-end behavior** - Tests the full flow from SDK → backend → database

## Architecture

### Global Setup (`vitest.integration.globalSetup.ts`)

Before any integration tests run:

1. **Validates environment variables** - Ensures `CORE_DATABASE_URL` and `ASSESSMENT_DATABASE_URL` are set
2. **Builds backend if needed** - Compiles backend if `dist/` doesn't exist
3. **Spawns test server** - Starts dedicated test server via `node dist/server-test.js` in `apps/backend`
4. **Waits for health endpoint** - Polls `/health` until the server is ready (max 30 seconds)
5. **Stores process reference** - Saves the server process to `globalThis` for cleanup

### Test Server Initialization (`server-test.ts`)

The dedicated test server entrypoint initializes all test infrastructure:

1. **Initializes database pools** - Connects to test databases
2. **Runs migrations** - Sets up schema
3. **Truncates tables** - Ensures clean state
4. **Seeds baseFixture** - Creates comprehensive test data (orgs, users, task variants, administrations)
5. **Initializes FGA** - Creates FGA store, deploys authorization model, syncs tuples from Postgres
6. **Mocks AuthService** - Replaces provider with TestAuthProvider for test tokens
7. **Writes fixture data to file** - Saves fixture IDs to `/tmp/roar-test-fixture.json` for SDK tests
8. **Starts Express server** - Listens on configured port

### Test Execution

Each integration test:

1. Reads fixture data from file (task variant IDs, user authIds)
2. Gets the backend URL from the global setup
3. Makes HTTP requests directly to the backend
4. Validates responses match the API contract
5. Exercises real FGA authorization checks

### Production Code

The production backend (`server.ts`) is completely clean:

- No test seeding logic
- No NODE_ENV checks
- No test routes
- No conditional auth providers
- All test infrastructure isolated in `server-test.ts`

## Running Integration Tests

### Prerequisites

1. **PostgreSQL running locally** with test databases:

   ```bash
   createdb core_test
   createdb assessment_test
   ```

2. **Environment variables** set:

   ```bash
   export CORE_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/core_test"
   export ASSESSMENT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assessment_test"
   ```

3. **Backend dependencies installed**:

   ```bash
   npm install -w apps/backend
   ```

4. **Backend built** (or let globalSetup build it automatically):

   ```bash
   npm run build -w apps/backend
   ```

   Note: The global setup will automatically build the backend if `dist/server-test.js` doesn't exist. It checks for the test server binary specifically (not just the `dist/` directory) to ensure the build includes `BUILD_TEST_SERVER=true`.

   **Caveat:** If you previously ran `npm run build -w apps/backend` without `BUILD_TEST_SERVER=true`, the `dist/` directory exists but `dist/server-test.js` is missing. The global setup will rebuild with the correct environment variable. If tests fail unexpectedly, try `BUILD_TEST_SERVER=true npm run build -w apps/backend` to rebuild explicitly.

### Run Tests Locally

```bash
# Run unit tests (default, no backend required)
npm run test -w packages/assessment-sdk

# Run integration tests (requires backend, databases, and environment setup)
npm run test:integration -w packages/assessment-sdk

# Run specific integration test file
npm run test:integration -w packages/assessment-sdk -- roar-api.integration.test.ts

# Run integration tests with watch mode
npm run test:integration:watch -w packages/assessment-sdk
```

### Run in CI

The CI pipeline automatically:

1. Starts PostgreSQL service
2. Creates test databases
3. Sets environment variables
4. Runs integration tests

Example GitHub Actions workflow:

```yaml
- name: Start PostgreSQL
  uses: ankane/setup-postgres@v1
  with:
    postgres-version: 15

- name: Create test databases
  run: |
    createdb core_test
    createdb assessment_test

- name: Run SDK integration tests
  env:
    CORE_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/core_test
    ASSESSMENT_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/assessment_test
  run: npm run test:integration -w packages/assessment-sdk
```

## Test Cases

### POST /v1/runs (Create Run)

- ✅ Create anonymous run successfully
- ✅ Create run with metadata
- ✅ Return 422 for invalid task variant ID
- ✅ Reject anonymous run with administrationId

### POST /v1/runs/:runId/event (Run Events)

- ✅ Complete a run successfully
- ✅ Write a trial to a run
- ✅ Abort a run
- ✅ Update engagement flags
- ✅ Return 404 for non-existent run
- ✅ Return 409 when completing an already completed run

### Happy Path: Full Run Lifecycle

- ✅ Create → Write trials → Update engagement → Complete

### FGA Authorization (non-anonymous runs)

- ✅ Create authenticated run with real administrationId (exercises FGA `can_create_run` check)
- ✅ Return 403 for administration outside user hierarchy (negative case — verifies FGA denies unauthorized access)

## Test Data

### Seeding Strategy

**Decision: Use backend's baseFixture seeding with file-based discovery**

Test server seeds comprehensive test data and writes fixture IDs to a file:

1. Test server seeds baseFixture (org hierarchy, users, task variants, administrations)
2. Test server writes fixture data to `/tmp/roar-test-fixture.json`
3. SDK tests read the fixture file to get task variant IDs
4. Tests use the dynamic IDs instead of hardcoded UUIDs

This approach:

- ✅ Uses backend's existing comprehensive test data (baseFixture)
- ✅ Avoids hardcoded UUIDs that may not exist
- ✅ Provides realistic test scenarios with proper org hierarchy
- ✅ Aligns with backend's integration test patterns
- ✅ Simplifies maintenance (no hardcoded IDs to update)
- ✅ No race conditions (file written before tests start)
- ✅ No HTTP overhead (direct file read)
- ✅ No test routes in production code

### Test Server Seeding Process

The test server (`server-test.ts`) initializes test infrastructure in this order:

1. **Database setup**
   - Initializes database pools
   - Runs migrations
   - Truncates all tables (ensures clean state)

2. **Test data seeding**
   - Seeds comprehensive baseFixture via Fishery factories:
     - Organization hierarchy (districts, schools, classes)
     - Users with various roles and enrollments
     - Task variants (variantForAllGrades, variantForGrade5, variantForGrade3, etc.)
     - Administrations assigned to various org levels

3. **FGA authorization**
   - Creates FGA store (same as backend integration tests)
   - Deploys authorization model
   - Syncs tuples from Postgres (reads junction tables, writes FGA tuples)

4. **Authentication mocking**
   - Replaces AuthService provider with TestAuthProvider
   - Allows test tokens (token string = Firebase UID)

5. **Fixture discovery**
   - Writes fixture data to JSON file (`/tmp/roar-test-fixture.json`)
   - SDK tests read this file instead of making HTTP calls
   - Avoids race conditions and keeps test infrastructure out of production code

**Key difference from old approach:** FGA is now fully initialized, so SDK tests can exercise real authorization checks instead of using anonymous runs.

### Test Authentication

In test mode, the test server mocks `AuthService` with `TestAuthProvider`, which treats the token string directly as the Firebase UID, bypassing Firebase Admin SDK verification. This allows SDK integration tests to authenticate without real Firebase credentials.

The SDK test helper reads the test user's `authId` from the fixture file and uses it as the Bearer token. This ensures the token matches a real user in the seeded database, allowing all authorization checks to pass.

### Test Fixture File

**File:** `/tmp/roar-test-fixture.json` (written by test server during startup)

Contains the seeded baseFixture data:

```json
{
  "testUser": {
    "authId": "schoolAStudent-auth-id"
  },
  "variantForAllGrades": { "id": "uuid-1" },
  "variantForGrade5": { "id": "uuid-2" },
  "variantForGrade3": { "id": "uuid-3" },
  "variantOptionalForEll": { "id": "uuid-4" },
  "variantForTask2": { "id": "uuid-5" },
  "variantForTask2Grade5OptionalEll": { "id": "uuid-6" }
}
```

SDK tests read this file via `getBaseFixtureData()` in `src/test-support/sdk-test-helper.ts`.

### Authentication Token Strategy

**Decision: Use real user's authId from seeded fixture**

- `getBaseFixtureData()` reads the fixture file and extracts `testUser.authId`
- This real user's authId is cached in `createTestAuthContext()` before any authenticated requests
- The token is reused across all tests for performance
- This ensures the token matches a real user in the database, allowing authorization checks to pass
- Token format: `<schoolAStudent.authId>` (real UUID from seeded database)
- In test mode, `TestAuthProvider` treats the token string directly as the Firebase UID

See `src/test-support/sdk-test-helper.ts` for implementation.

**Important:** `getBaseFixtureData()` must be called in `beforeAll()` before any authenticated requests. The fixture file is written by the test server during startup, so it's guaranteed to exist before tests run.

## Debugging

### View Backend Output

Backend logs are printed to stdout/stderr during test execution:

```
[Backend stdout] Server listening on http://localhost:4001
[Backend stderr] Error: Database connection failed
```

### Increase Timeout

If tests timeout waiting for the backend:

```bash
# Increase global setup timeout
npm run test:integration -w packages/assessment-sdk -- --testTimeout=60000
```

### Check Backend Health

Manually verify the backend is running:

```bash
curl http://localhost:4001/health
# {"status":"ok"}
```

### View Test Database

Connect directly to test databases:

```bash
psql core_test
psql assessment_test
```

## Troubleshooting

### Backend fails to start

**Error**: `Backend failed to start after 30 attempts`

**Causes**:

- Database connection string is incorrect
- PostgreSQL is not running
- Port 4001 is already in use

**Solution**:

```bash
# Check PostgreSQL is running
psql -U postgres -d postgres -c "SELECT 1"

# Check port is available
lsof -i :4001

# Verify database URLs
echo $CORE_DATABASE_URL
echo $ASSESSMENT_DATABASE_URL
```

### Tests timeout

**Error**: `Backend startup timeout after 30000ms`

**Causes**:

- Backend is slow to start (migrations taking time)
- Health endpoint is not responding

**Solution**:

- Increase `BACKEND_START_TIMEOUT` in `vitest.integration.globalSetup.ts`
- Check backend logs for errors
- Ensure test databases exist and are accessible

### Authentication failures

**Error**: `401 Unauthorized`

**Cause**: Backend is rejecting the test token

**Solution**:

- The backend uses `TestAuthProvider` instead of Firebase in test mode
- Ensure `NODE_ENV=test` is set when backend starts
- Check that `AuthService` is using `TestAuthProvider` (not `FirebaseAuthProvider`)

## Architecture Decisions

### Why use a dedicated test server entrypoint?

- **Clean separation**: All test infrastructure in one place, production code untouched
- **Reuses patterns**: Uses same test-support utilities as backend integration tests
- **Full authorization**: Initializes FGA same way backend tests do
- **No race conditions**: Fixture data written to file during startup
- **Isolation**: Each test run gets a fresh server process
- **Reliability**: Automatic cleanup on test completion
- **CI-friendly**: Works in containerized environments
- **Auto-build**: Automatically builds backend if `dist/` doesn't exist

### Why use file-based fixture discovery?

- **No race conditions**: Fixture file written before tests start
- **No HTTP overhead**: Direct file read instead of HTTP call
- **No test routes**: Keeps production code clean
- **Clear dependency**: Tests explicitly depend on fixture file
- **Easier debugging**: Can inspect fixture file directly
- **Realism**: Uses the same comprehensive test data as backend integration tests
- **Maintainability**: No hardcoded UUIDs to update when test data changes
- **Alignment**: Matches backend's integration test patterns (baseFixture, Fishery factories)

### Why use shared test token across all tests?

- **Performance**: Avoids token generation overhead (single token cached and reused)
- **Simplicity**: No per-test or per-describe-block token management
- **Acceptable isolation**: Tests don't require token-level isolation
- **Aligns with CI**: Matches the CI pipeline's single-token approach

### Why use SDK client instead of raw HTTP requests?

- **Type safety**: SDK client provides full TypeScript types for requests and responses
- **Contract validation**: ts-rest client validates request/response shapes match the API contract
- **Abstraction layer**: Tests exercise the SDK's actual API client, not just HTTP
- **Consistency**: Matches how real users interact with the SDK
- **Error handling**: SDK client handles serialization and error mapping

### Why test databases instead of in-memory?

- **Accuracy**: Tests use the same database as production
- **Migrations**: Validates schema changes work correctly
- **Transactions**: Tests can verify transaction behavior
- **Performance**: Realistic performance characteristics

## Future Improvements

- [ ] Parallel test execution (currently single fork)
- [ ] Test data factories for common scenarios
- [ ] Performance benchmarks
- [ ] Load testing suite
- [ ] Contract testing with Pact
- [ ] Snapshot testing for response shapes

## References

- [Backend Integration Tests](../../apps/backend/INTEGRATION_TESTS.md)
- [Test Server Entrypoint](../../apps/backend/src/server-test.ts)
- [Vitest Configuration](./vitest.config.ts)
- [Global Setup](./vitest.integration.globalSetup.ts)
- [Test Helper](./src/test-support/sdk-test-helper.ts)
- [Integration Tests](./src/receiver/roar-api.integration.test.ts)
