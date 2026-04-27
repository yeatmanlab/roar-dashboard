/**
 * Assessment SDK Integration Tests
 *
 * Tests the Assessment SDK against a real backend running on test databases.
 * Validates end-to-end behavior of the SDK's API client.
 *
 * SETUP REQUIREMENTS:
 * - Backend must be running (started by vitest.integration.globalSetup.ts)
 * - Test databases must exist (CORE_DATABASE_URL, ASSESSMENT_DATABASE_URL)
 * - Backend's baseFixture is automatically seeded by server-test.ts during startup
 *   This provides task variants and administrations for testing
 *
 * AUTHENTICATION:
 * - Uses a shared test token across all tests for performance
 * - Token is cached in createTestAuthContext() and reused
 * - This is acceptable since tests don't require token isolation
 *
 * TEST DATA:
 * - Uses backend's baseFixture seeding which provides:
 *   - Task variants (variantForAllGrades, variantForGrade5, etc.)
 *   - Administrations assigned to various org levels
 *   - Users with different roles and enrollments
 *
 * RUNNING INTEGRATION TESTS:
 * - These tests are skipped by default locally (no RUN_INTEGRATION_TESTS env var)
 * - They require external services (PostgreSQL, OpenFGA) to be running
 * - In CI, they run automatically with RUN_INTEGRATION_TESTS=true
 * - To run locally: RUN_INTEGRATION_TESTS=true npm run test -w packages/assessment-sdk
 * - Or: RUN_INTEGRATION_TESTS=true npm run test:integration -w packages/assessment-sdk
 *   (the test:integration script requires the env var to register the integration project)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initTestSdk, getBaseFixtureData } from '../test-support/sdk-test-helper';
import type { RoarApi } from './roar-api';

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('Assessment SDK (integration)', () => {
  let api: RoarApi;
  let taskVariantId: string;

  beforeAll(async () => {
    // Guard: Vitest still runs beforeAll hooks for skipped suites, so bail early
    if (!process.env.RUN_INTEGRATION_TESTS) {
      return;
    }

    const sdk = initTestSdk();
    api = sdk.api;

    // Get task variant from backend's baseFixture seeding
    const fixtureData = await getBaseFixtureData();
    taskVariantId = fixtureData.variantForAllGrades.id;

    console.log('[SDK Integration Tests] SDK initialized with task variant:', taskVariantId);
  });

  describe('POST /v1/runs (create run)', () => {
    it('should create an anonymous run successfully', async () => {
      const taskVersion = '1.0.0';

      const response = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion,
          isAnonymous: true,
        },
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data.id');
      if (response.status === 201 && 'data' in response.body) {
        const id = response.body.data?.id;
        expect(id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      }
    });

    it('should create a run with metadata', async () => {
      const taskVersion = '1.0.0';
      const metadata = { source: 'test-dashboard', sessionId: 'sess-123' };

      const response = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion,
          isAnonymous: true,
          metadata,
        },
      });

      expect(response.status).toBe(201);
      if (response.status === 201 && 'data' in response.body) {
        expect(response.body.data?.id).toBeDefined();
      }
    });

    it('should return 422 for invalid task variant ID', async () => {
      const invalidTaskVariantId = '00000000-0000-0000-0000-000000000000';
      const taskVersion = '1.0.0';

      const response = await api.client.runs.create({
        body: {
          taskVariantId: invalidTaskVariantId,
          taskVersion,
          isAnonymous: true,
        },
      });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject anonymous run with administrationId', async () => {
      const taskVersion = '1.0.0';
      const administrationId = '660e8400-e29b-41d4-a716-446655440001';

      const response = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion,
          isAnonymous: true,
          administrationId,
        },
      });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /v1/runs/:runId/event (run events)', () => {
    it('should complete a run successfully', async () => {
      // Create a run first
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('data.id');
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      // Complete the run
      const completeResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'complete',
          metadata: { finalScore: 85 },
        },
      });

      expect(completeResponse.status).toBe(200);
      if (completeResponse.status === 200 && 'data' in completeResponse.body) {
        expect(completeResponse.body.data?.status).toBe('ok');
      }
    });

    it('should write a trial to a run', async () => {
      // Create a run first
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      // Write a trial
      const trialResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'trial',
          trial: {
            assessmentStage: 'test',
            correct: 1,
            responseTime: 2500,
          },
          interactions: [
            {
              event: 'focus',
              timeMs: 100,
            },
            {
              event: 'blur',
              timeMs: 2400,
            },
          ],
        },
      });

      expect(trialResponse.status).toBe(200);
      if (trialResponse.status === 200 && 'data' in trialResponse.body) {
        expect(trialResponse.body.data?.status).toBe('ok');
      }
    });

    it('should abort a run', async () => {
      // Create a run first
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      // Abort the run
      const abortResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'abort',
        },
      });

      expect(abortResponse.status).toBe(200);
      if (abortResponse.status === 200 && 'data' in abortResponse.body) {
        expect(abortResponse.body.data?.status).toBe('ok');
      }
    });

    it('should update engagement flags', async () => {
      // Create a run first
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      // Update engagement
      const engagementResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'engagement',
          engagementFlags: {
            incomplete: false,
            responseTimeTooFast: false,
            accuracyTooLow: false,
            notEnoughResponses: false,
          },
          reliableRun: true,
        },
      });

      expect(engagementResponse.status).toBe(200);
      if (engagementResponse.status === 200 && 'data' in engagementResponse.body) {
        expect(engagementResponse.body.data?.status).toBe('ok');
      }
    });

    it('should return 404 for non-existent run', async () => {
      const nonExistentRunId = '00000000-0000-0000-0000-000000000000';

      const response = await api.client.runs.event({
        params: { runId: nonExistentRunId },
        body: {
          type: 'complete',
        },
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 when completing an already completed run', async () => {
      // Create and complete a run
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      const firstComplete = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'complete',
        },
      });
      expect(firstComplete.status).toBe(200);

      // Try to complete again
      const secondComplete = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'complete',
        },
      });

      expect(secondComplete.status).toBe(409);
      expect(secondComplete.body).toHaveProperty('error');
    });
  });

  describe('Happy path: Full run lifecycle', () => {
    it('should complete a full run lifecycle: create -> trial -> complete', async () => {
      // 1. Create run
      const createResponse = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: true,
        },
      });

      expect(createResponse.status).toBe(201);
      if (createResponse.status !== 201 || !('data' in createResponse.body)) {
        throw new Error('Failed to create run');
      }
      const runId = createResponse.body.data?.id;
      expect(runId).toBeDefined();

      // 2. Write multiple trials
      for (let i = 0; i < 3; i++) {
        const trialResponse = await api.client.runs.event({
          params: { runId: runId! },
          body: {
            type: 'trial',
            trial: {
              assessmentStage: 'test',
              correct: i % 2,
              responseTime: 1000 + i * 500,
            },
          },
        });

        expect(trialResponse.status).toBe(200);
      }

      // 3. Update engagement
      const engagementResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'engagement',
          engagementFlags: {
            incomplete: false,
            responseTimeTooFast: false,
            accuracyTooLow: false,
            notEnoughResponses: false,
          },
          reliableRun: true,
        },
      });

      expect(engagementResponse.status).toBe(200);

      // 4. Complete run
      const completeResponse = await api.client.runs.event({
        params: { runId: runId! },
        body: {
          type: 'complete',
          metadata: { finalScore: 67 },
        },
      });

      expect(completeResponse.status).toBe(200);
      if (completeResponse.status === 200 && 'data' in completeResponse.body) {
        expect(completeResponse.body.data?.status).toBe('ok');
      }
    });
  });

  describe('FGA Authorization (non-anonymous runs)', () => {
    it('should create an authenticated run with administrationId and exercise FGA authorization', async () => {
      // This test exercises real FGA authorization checks.
      // The test server initializes FGA and syncs tuples from Postgres,
      // so this verifies end-to-end authorization behavior.

      const fixtureData = await getBaseFixtureData();
      const administrationId = fixtureData.administrationAssignedToDistrict.id;

      // Create an authenticated run (non-anonymous) with administrationId
      // The testUser (schoolAStudent) is enrolled in the district and has FGA access
      // to administrationAssignedToDistrict via the org hierarchy.
      const response = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: false,
          administrationId,
        },
      });

      // Should succeed because the user has FGA permission to the administration
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data.id');
      if (response.status === 201 && 'data' in response.body) {
        const runId = response.body.data?.id;
        expect(runId).toBeDefined();
        expect(runId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      }
    });

    it('should return 403 for administration outside user hierarchy', async () => {
      // This test verifies the negative case: user is denied access to an administration
      // they are not authorized for. schoolAStudent is enrolled in district (and schoolA),
      // but has no FGA tuples for districtB or its administrations.
      // Without this test, the FGA can_read check could be silently disabled
      // and the test suite would still pass.

      const fixtureData = await getBaseFixtureData();
      const unauthorizedAdminId = fixtureData.administrationAssignedToDistrictB.id;

      const response = await api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: false,
          administrationId: unauthorizedAdminId,
        },
      });

      // Should fail because the user has no FGA permission to administrationAssignedToDistrictB
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 when user lacks CAN_CREATE_RUN permission', async () => {
      // This test verifies the CAN_CREATE_RUN authorization gate specifically.
      // schoolATeacher has CAN_READ access to administrationAssignedToDistrict
      // (via org hierarchy) but does NOT have CAN_CREATE_RUN permission.
      // The flow is:
      // 1. verifyAdministrationAccess checks CAN_READ → passes
      // 2. requirePermission checks CAN_CREATE_RUN → fails with 403
      // Without this test, the CAN_CREATE_RUN check could be silently disabled
      // and the test suite would still pass.

      const fixtureData = await getBaseFixtureData();
      const administrationId = fixtureData.administrationAssignedToDistrict.id;

      // Create a new SDK instance with schoolATeacher's token
      const teacherAuthId = fixtureData.schoolATeacher.authId;
      const teacherSdk = initTestSdk({
        auth: {
          getToken: async () => teacherAuthId,
          refreshToken: async () => teacherAuthId,
        },
      });

      const response = await teacherSdk.api.client.runs.create({
        body: {
          taskVariantId,
          taskVersion: '1.0.0',
          isAnonymous: false,
          administrationId,
        },
      });

      // Should fail because schoolATeacher lacks CAN_CREATE_RUN permission
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });
});
