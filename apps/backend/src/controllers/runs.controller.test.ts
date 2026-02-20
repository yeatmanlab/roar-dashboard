import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Mock the RunService module
vi.mock('../services/run/run.service', () => ({
  RunService: vi.fn(),
}));

// Mock the RunEventsService module
vi.mock('../services/run/run-events.service', () => ({
  RunEventsService: vi.fn(),
}));

import { RunService } from '../services/run/run.service';
import { RunEventsService } from '../services/run/run-events.service';

/**
 * RunsController Tests
 *
 * Tests verify the controller's error handling behavior and response structure.
 * The create endpoint is tested with mocked RunService to isolate controller logic.
 *
<<<<<<< run/runId/event-abortRun
 * For comprehensive testing of the business logic, see:
 * - run.service.test.ts for create endpoint logic
 * - run-events.service.test.ts for event endpoint logic
 *
 * The controller handles HTTP concerns and delegates business logic to services:
 * - create: POST /runs - Creates a new run
 * - event: POST /runs/:runId/event - Handles run events (complete, abort)
=======
 * For comprehensive testing of the create endpoint business logic, see run.service.test.ts
 * which tests the service in isolation.
>>>>>>> run/runId/event-completeRun
 */
describe('RunsController', () => {
  const mockCreate = vi.fn();
  const mockCompleteRun = vi.fn();
  const mockAuthContext = { userId: 'test-user', isSuperAdmin: false };
  const mockBody = {
    task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
    task_version: '1.0.0',
    administration_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock RunService
    vi.mocked(RunService).mockReturnValue({
      create: mockCreate,
    });

    // Setup the mock RunEventsService
    vi.mocked(RunEventsService).mockReturnValue({
      completeRun: mockCompleteRun,
    });
  });

  it('should export RunsController with create method', async () => {
    const { RunsController } = await import('./runs.controller');

    expect(RunsController).toBeDefined();
    expect(RunsController.create).toBeDefined();
    expect(RunsController.event).toBeDefined();
    expect(typeof RunsController.create).toBe('function');
  });

  describe('create', () => {
    it('should return 201 CREATED with run_id on success', async () => {
      mockCreate.mockResolvedValue({ runId: 'run-uuid-123' });

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.CREATED);
      expect(result.body).toEqual({
        data: { run_id: 'run-uuid-123' },
      });
    });

    it('should pass auth context and body to service', async () => {
      mockCreate.mockResolvedValue({ runId: 'run-uuid-123' });

      const { RunsController } = await import('./runs.controller');

      const customAuthContext = { userId: 'user-456', isSuperAdmin: true };
      await RunsController.create(customAuthContext, mockBody);

      expect(mockCreate).toHaveBeenCalledWith(customAuthContext, mockBody);
    });

    it('should return 422 when service throws UNPROCESSABLE_ENTITY ApiError', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Invalid administration_id', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(result.body).toEqual({
        error: {
          message: 'Invalid administration_id',
          code: 'request/validation-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when service throws FORBIDDEN ApiError', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('You do not have permission to create a run', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to create a run',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR ApiError', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Failed to create run', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Failed to create run',
          code: 'database/query-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 400 when service throws BAD_REQUEST ApiError', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Invalid request', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.body).toEqual({
        error: {
          message: 'Invalid request',
          code: 'request/validation-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 401 when service throws UNAUTHORIZED ApiError', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Authentication required', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_REQUIRED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(result.body).toEqual({
        error: {
          message: 'Authentication required',
          code: 'auth/required',
          traceId: expect.any(String),
        },
      });
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockCreate.mockRejectedValue(unexpectedError);

      const { RunsController } = await import('./runs.controller');

      await expect(RunsController.create(mockAuthContext, mockBody)).rejects.toThrow('Database connection lost');
    });

    it('should include error code in error response', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Invalid task variant', {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.body).toHaveProperty('error.code');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as any).error.code).toBe('request/validation-failed');
    });

    it('should include traceId in error response for observability', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Service error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.create(mockAuthContext, mockBody);

      expect(result.body).toHaveProperty('error.traceId');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (result.body as any).error.traceId).toBe('string');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as any).error.traceId.length).toBeGreaterThan(0);
    });
  });

  describe('event', () => {
    const validRunId = '550e8400-e29b-41d4-a716-446655440000';
    const validEventBody = { type: 'complete' as const };

    it('should return 200 OK on success', async () => {
      mockCompleteRun.mockResolvedValue(undefined);

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: { status: 'ok' },
      });
    });

    it('should pass auth context, runId, and body to service', async () => {
      mockCompleteRun.mockResolvedValue(undefined);

      const { RunsController } = await import('./runs.controller');

      const customAuthContext = { userId: 'user-456', isSuperAdmin: true };
      await RunsController.event(customAuthContext, validRunId, validEventBody);

      expect(mockCompleteRun).toHaveBeenCalledWith(customAuthContext, validRunId, validEventBody);
    });

    it('should return 400 when service throws BAD_REQUEST ApiError', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Invalid event type', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.body).toEqual({
        error: {
          message: 'Invalid event type',
          code: 'request/validation-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 401 when service throws UNAUTHORIZED ApiError', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Authentication required', {
          statusCode: StatusCodes.UNAUTHORIZED,
          code: ApiErrorCode.AUTH_REQUIRED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(result.body).toEqual({
        error: {
          message: 'Authentication required',
          code: 'auth/required',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when service throws FORBIDDEN ApiError', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('You do not own this run', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not own this run',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 404 when service throws NOT_FOUND ApiError', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Run not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Run not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR ApiError', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Failed to complete run', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Failed to complete run',
          code: 'database/query-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockCompleteRun.mockRejectedValue(unexpectedError);

      const { RunsController } = await import('./runs.controller');

      await expect(RunsController.event(mockAuthContext, validRunId, validEventBody)).rejects.toThrow(
        'Database connection lost',
      );
    });

    it('should include error code in error response', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Run not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.body).toHaveProperty('error.code');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as any).error.code).toBe('resource/not-found');
    });

    it('should include traceId in error response for observability', async () => {
      mockCompleteRun.mockRejectedValue(
        new ApiError('Service error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { RunsController } = await import('./runs.controller');

      const result = await RunsController.event(mockAuthContext, validRunId, validEventBody);

      expect(result.body).toHaveProperty('error.traceId');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (result.body as any).error.traceId).toBe('string');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as any).error.traceId.length).toBeGreaterThan(0);
    });
  });

  describe('event', () => {
    it('should have proper method signature', async () => {
      const { RunsController } = await import('./runs.controller');

      const eventMethod = RunsController.event;
      expect(eventMethod).toBeDefined();
      expect(eventMethod.length).toBe(3); // authContext, runId, body
    });
  });

  describe('create', () => {
    it('should have proper method signature', async () => {
      const { RunsController } = await import('./runs.controller');

      const createMethod = RunsController.create;
      expect(createMethod).toBeDefined();
      expect(createMethod.length).toBe(2); // authContext, body
    });
  });
});
