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
- Seeds test data via factories (optional, controlled by `SEED_TEST_DATA=true`)
- Initializes FGA test store with authorization model

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
2. Truncates all tables (per-file isolation)
3. Seeds comprehensive baseFixture via Fishery factories:
   - Organization hierarchy (districts, schools, classes)
   - Users with various roles and enrollments
   - Task variants (variantForAllGrades, variantForGrade5, variantForGrade3, etc.)
   - Administrations assigned to various org levels
4. Initializes FGA test store with authorization model
5. Syncs FGA tuples from PostgreSQL

### Test Fixture Endpoint

**GET `/v1/test/fixture`** (test mode only)

Returns the seeded baseFixture data:

```json
{
  "variantForAllGrades": { "id": "uuid-1" },
  "variantForGrade5": { "id": "uuid-2" },
  "variantForGrade3": { "id": "uuid-3" },
  "variantOptionalForEll": { "id": "uuid-4" },
  "variantForTask2": { "id": "uuid-5" },
  "variantForTask2Grade5OptionalEll": { "id": "uuid-6" }
}
```

### Authentication Token Strategy

**Decision: Use shared test token across all tests (Option C)**

- A single test token is generated once and cached in `createTestAuthContext()`
- The token is reused across all tests for performance
- This is acceptable since tests don't require token isolation
- Token format: `test-token-<random>`

See `src/test-support/sdk-test-helper.ts` for implementation.

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

- The backend mocks Firebase token verification in test mode
- Ensure `NODE_ENV=test` is set when backend starts
- Check `AuthService.verifyToken` is being mocked

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

### Why use HTTP requests instead of SDK client?

- **Realism**: Tests the actual HTTP layer, not just SDK abstractions
- **Contract validation**: Ensures request/response shapes match the API contract
- **Error handling**: Validates HTTP status codes and error responses
- **Flexibility**: Can test edge cases and invalid requests easily

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
