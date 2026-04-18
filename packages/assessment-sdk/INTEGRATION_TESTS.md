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
2. **Spawns backend process** - Starts the backend server via `npm run start` in `apps/backend`
3. **Waits for health endpoint** - Polls `/health` until the backend is ready (max 30 seconds)
4. **Stores process reference** - Saves the backend process to `globalThis` for cleanup

### Test Execution

Each integration test:

1. Gets the backend URL from the global setup
2. Makes HTTP requests directly to the backend
3. Validates responses match the API contract

### Backend Configuration

When the backend starts with `NODE_ENV=test`:

- Connects to test databases (`core_test`, `assessment_test`)
- Runs migrations automatically (via `vitest.integration.globalSetup.ts`)
- Seeds test data via factories (when `NODE_ENV=test` or `SEED_TEST_DATA=true`)
- **Note:** FGA authorization is NOT initialized during standalone server startup (see Backend Seeding Process section)

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

   Note: The global setup will automatically build the backend if `apps/backend/dist` doesn't exist. This requires the backend to be built before `npm run start` can run the compiled server.

   **Caveat:** If the backend source changes but `dist/` already exists, the old build is used. If tests fail unexpectedly, try `npm run build -w apps/backend` to rebuild.

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

## Test Data

### Seeding Strategy

**Decision: Use backend's baseFixture seeding (Option B)**

Tests dynamically fetch task variant IDs from the backend's baseFixture via a test endpoint:

1. Backend seeds comprehensive test data via `baseFixture` (org hierarchy, users, task variants, administrations)
2. SDK tests call `GET /v1/test/fixture` to retrieve task variant IDs
3. Tests use the dynamic IDs instead of hardcoded UUIDs

This approach:

- ✅ Uses backend's existing comprehensive test data (baseFixture)
- ✅ Avoids hardcoded UUIDs that may not exist
- ✅ Provides realistic test scenarios with proper org hierarchy
- ✅ Aligns with backend's integration test patterns
- ✅ Simplifies maintenance (no hardcoded IDs to update)

### Backend Seeding Process

When the backend starts in test mode (`NODE_ENV=test`):

1. Initializes database pools
2. Truncates all tables (ensures clean state on server startup)
3. Seeds comprehensive baseFixture via Fishery factories:
   - Organization hierarchy (districts, schools, classes)
   - Users with various roles and enrollments
   - Task variants (variantForAllGrades, variantForGrade5, variantForGrade3, etc.)
   - Administrations assigned to various org levels

**Note:** FGA authorization is NOT initialized during standalone server startup. SDK tests must use anonymous runs to avoid FGA permission checks. The backend's own integration tests initialize FGA via `vitest.setup.ts:46-47` (`resetFgaStoreForTestFile()` and `syncFgaTuplesFromPostgres()`), but these are not called when the server runs standalone.

### Test Authentication

In test mode (`NODE_ENV=test`), the backend uses `TestAuthProvider` which treats the token string directly as the Firebase UID, bypassing Firebase Admin SDK verification. This allows SDK integration tests to authenticate without real Firebase credentials.

The SDK test helper fetches the test user's `authId` from the `/v1/test/fixture` endpoint and uses it as the Bearer token. This ensures the token matches a real user in the seeded database, allowing all authorization checks to pass.

### Test Fixture Endpoint

**GET `/v1/test/fixture`** (test mode only, mounted at `/v1` by default)

Returns the seeded baseFixture data:

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

### Authentication Token Strategy

**Decision: Use real user's authId from seeded fixture**

- `getBaseFixtureData()` fetches the test fixture endpoint and extracts `testUser.authId`
- This real user's authId is cached in `createTestAuthContext()` before any authenticated requests
- The token is reused across all tests for performance
- This ensures the token matches a real user in the database, allowing authorization checks to pass
- Token format: `<schoolAStudent.authId>` (real UUID from seeded database)

See `src/test-support/sdk-test-helper.ts` for implementation.

**Important:** `getBaseFixtureData()` must be called in `beforeAll()` before any authenticated requests. If `createTestAuthContext()` is called without first fetching the fixture, it will use a fallback random token and requests will fail with 401. The current test suite has correct ordering, but this is a subtle footgun for new test files.

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

### Why spawn the backend in globalSetup?

- **Isolation**: Each test run gets a fresh backend process
- **Simplicity**: No need to manage a separate test server
- **Reliability**: Automatic cleanup on test completion
- **CI-friendly**: Works in containerized environments
- **Auto-build**: Automatically builds backend if `dist/` doesn't exist, matching CI pipeline behavior where `npm run test` is called after `npm run build`

### Why use backend's baseFixture seeding?

- **Realism**: Uses the same comprehensive test data as backend integration tests
- **Maintainability**: No hardcoded UUIDs to update when test data changes
- **Robustness**: Fails fast if seeding doesn't complete (fixture endpoint returns 503)
- **Alignment**: Matches backend's integration test patterns (baseFixture, Fishery factories)
- **Flexibility**: Easy to extend with additional test scenarios using the same fixture
- **CI-friendly**: Works seamlessly in CI pipeline where backend handles seeding

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
- [Vitest Configuration](./vitest.config.ts)
- [Global Setup](./vitest.integration.globalSetup.ts)
- [Test Helper](./src/test-support/sdk-test-helper.ts)
- [Integration Tests](./src/receiver/roar-api.integration.test.ts)
