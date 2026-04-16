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

### Run Tests Locally

```bash
# Run all integration tests
npm run test:integration -w packages/assessment-sdk

# Run specific test file
npm run test:integration -w packages/assessment-sdk -- roar-api.integration.test.ts

# Run with watch mode
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

Test data is seeded via Fishery factories in the backend:

- **Participants** - Created via `UserFactory.create()`
- **Tasks** - Created via `TaskFactory.create()`
- **Task Variants** - Created via `TaskVariantFactory.create()`
- **Administrations** - Created via `AdministrationFactory.create()`

The base fixture (`baseFixture`) provides a comprehensive test dataset with:

- Organization hierarchy (districts, schools, classes)
- User roles (admin, educator, student)
- Task variants with eligibility conditions
- Administrations assigned to various organizational units

### Using Test Data in Tests

Tests use hardcoded UUIDs for task variants (e.g., `550e8400-e29b-41d4-a716-446655440000`). These must be seeded in the test database before tests run.

To seed custom test data:

```typescript
import { TaskVariantFactory } from '../../apps/backend/src/test-support/factories/task-variant.factory';

const variant = await TaskVariantFactory.create({
  taskId: 'task-123',
  name: 'My Test Variant',
});
```

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
