/**
 * Assessment SDK Integration Tests
 *
 * Tests the Assessment SDK against a real backend running on test databases.
 * Validates end-to-end behavior of the SDK's API client.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initTestSdk } from '../test-support/sdk-test-helper';
import type { RoarApi } from './roar-api';

describe('Assessment SDK (integration)', () => {
  let api: RoarApi;

  beforeAll(() => {
    const sdk = initTestSdk();
    api = sdk.api;
    console.log('[SDK Integration Tests] SDK initialized');
  });

  describe('POST /v1/runs (create run)', () => {
    it('should create an anonymous run successfully', async () => {
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
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
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
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
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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
      const abortResponse = await api.client.runEvents.create({
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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
      const engagementResponse = await api.client.runEvents.create({
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

      const response = await api.client.runEvents.create({
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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

      const firstComplete = await api.client.runEvents.create({
        params: { runId: runId! },
        body: {
          type: 'complete',
        },
      });
      expect(firstComplete.status).toBe(200);

      // Try to complete again
      const secondComplete = await api.client.runEvents.create({
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
          taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
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
        const trialResponse = await api.client.runEvents.create({
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
      const engagementResponse = await api.client.runEvents.create({
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
      const completeResponse = await api.client.runEvents.create({
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
});
