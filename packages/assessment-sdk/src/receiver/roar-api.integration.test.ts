/**
 * Assessment SDK Integration Tests
 *
 * Tests the Assessment SDK against a real backend running on test databases.
 * Validates end-to-end behavior of the runs endpoints via HTTP.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getBackendUrl } from '../test-support/sdk-test-helper';

interface ApiResponse<T> {
  status: number;
  body: T;
}

interface CreateRunResponse {
  data?: {
    id?: string;
  };
  error?: unknown;
}

interface RunEventResponse {
  data?: {
    status?: string;
  };
  error?: unknown;
}

describe('Assessment SDK (integration)', () => {
  let backendUrl: string;
  let authToken: string;

  beforeAll(() => {
    backendUrl = getBackendUrl();
    authToken = 'test-token-' + Math.random().toString(36).slice(2);
    console.log(`[Integration Tests] Using backend at ${backendUrl}`);
  });

  /**
   * Helper to make HTTP requests to the backend
   */
  async function makeRequest<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${backendUrl}${path}`, init);
    const data = (await response.json()) as T;
    return { status: response.status, body: data };
  }

  describe('POST /v1/runs (create run)', () => {
    it('should create an anonymous run successfully', async () => {
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
      const taskVersion = '1.0.0';

      const response = await makeRequest('/v1/runs', 'POST', {
        taskVariantId,
        taskVersion,
        isAnonymous: true,
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data.id');
      const id = (response.body as CreateRunResponse).data?.id;
      expect(id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should create a run with metadata', async () => {
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
      const taskVersion = '1.0.0';
      const metadata = { source: 'test-dashboard', sessionId: 'sess-123' };

      const response = await makeRequest('/v1/runs', 'POST', {
        taskVariantId,
        taskVersion,
        isAnonymous: true,
        metadata,
      });

      expect(response.status).toBe(201);
      expect((response.body as CreateRunResponse).data?.id).toBeDefined();
    });

    it('should return 422 for invalid task variant ID', async () => {
      const invalidTaskVariantId = '00000000-0000-0000-0000-000000000000';
      const taskVersion = '1.0.0';

      const response = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: invalidTaskVariantId,
        taskVersion,
        isAnonymous: true,
      });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject anonymous run with administrationId', async () => {
      const taskVariantId = '550e8400-e29b-41d4-a716-446655440000';
      const taskVersion = '1.0.0';
      const administrationId = '660e8400-e29b-41d4-a716-446655440001';

      const response = await makeRequest('/v1/runs', 'POST', {
        taskVariantId,
        taskVersion,
        isAnonymous: true,
        administrationId,
      });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /v1/runs/:runId/event (run events)', () => {
    it('should complete a run successfully', async () => {
      // Create a run first
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(createResponse.status).toBe(201);
      const runId = (createResponse.body as CreateRunResponse).data?.id;

      // Complete the run
      const completeResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'complete',
        metadata: { finalScore: 85 },
      });

      expect(completeResponse.status).toBe(200);
      expect((completeResponse.body as RunEventResponse).data?.status).toBe('ok');
    });

    it('should write a trial to a run', async () => {
      // Create a run first
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(createResponse.status).toBe(201);
      const runId = (createResponse.body as CreateRunResponse).data?.id;

      // Write a trial
      const trialResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
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
      });

      expect(trialResponse.status).toBe(200);
      expect((trialResponse.body as RunEventResponse).data?.status).toBe('ok');
    });

    it('should abort a run', async () => {
      // Create a run first
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(createResponse.status).toBe(201);
      const runId = (createResponse.body as CreateRunResponse).data?.id;

      // Abort the run
      const abortResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'abort',
      });

      expect(abortResponse.status).toBe(200);
      expect((abortResponse.body as RunEventResponse).data?.status).toBe('ok');
    });

    it('should update engagement flags', async () => {
      // Create a run first
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(createResponse.status).toBe(201);
      const runId = (createResponse.body as CreateRunResponse).data?.id;

      // Update engagement
      const engagementResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'engagement',
        engagementFlags: {
          incomplete: false,
          responseTimeTooFast: false,
          accuracyTooLow: false,
          notEnoughResponses: false,
        },
        reliableRun: true,
      });

      expect(engagementResponse.status).toBe(200);
      expect((engagementResponse.body as RunEventResponse).data?.status).toBe('ok');
    });

    it('should return 404 for non-existent run', async () => {
      const nonExistentRunId = '00000000-0000-0000-0000-000000000000';

      const response = await makeRequest(`/v1/runs/${nonExistentRunId}/event`, 'POST', {
        type: 'complete',
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 when completing an already completed run', async () => {
      // Create and complete a run
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      const runId = (createResponse.body as CreateRunResponse).data?.id;

      const firstComplete = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'complete',
      });
      expect(firstComplete.status).toBe(200);

      // Try to complete again
      const secondComplete = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'complete',
      });

      expect(secondComplete.status).toBe(409);
      expect(secondComplete.body).toHaveProperty('error');
    });
  });

  describe('Happy path: Full run lifecycle', () => {
    it('should complete a full run lifecycle: create -> trial -> complete', async () => {
      // 1. Create run
      const createResponse = await makeRequest('/v1/runs', 'POST', {
        taskVariantId: '550e8400-e29b-41d4-a716-446655440000',
        taskVersion: '1.0.0',
        isAnonymous: true,
      });

      expect(createResponse.status).toBe(201);
      const runId = (createResponse.body as CreateRunResponse).data?.id;

      // 2. Write multiple trials
      for (let i = 0; i < 3; i++) {
        const trialResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
          type: 'trial',
          trial: {
            assessmentStage: 'test',
            correct: i % 2,
            responseTime: 1000 + i * 500,
          },
        });

        expect(trialResponse.status).toBe(200);
      }

      // 3. Update engagement
      const engagementResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'engagement',
        engagementFlags: {
          incomplete: false,
          responseTimeTooFast: false,
          accuracyTooLow: false,
          notEnoughResponses: false,
        },
        reliableRun: true,
      });

      expect(engagementResponse.status).toBe(200);

      // 4. Complete run
      const completeResponse = await makeRequest(`/v1/runs/${runId}/event`, 'POST', {
        type: 'complete',
        metadata: { finalScore: 67 },
      });

      expect(completeResponse.status).toBe(200);
      expect((completeResponse.body as RunEventResponse).data?.status).toBe('ok');
    });
  });
});
