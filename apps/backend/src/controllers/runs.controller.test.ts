import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Mock the RunService module
vi.mock('../services/run/run.service', () => ({
  RunService: vi.fn(),
}));

import { RunService } from '../services/run/run.service';

/**
 * RunsController Tests
 *
 * Tests verify the controller's error handling behavior and response structure.
 * The create endpoint is tested with mocked RunService to isolate controller logic.
 *
 * For comprehensive testing of the create endpoint business logic, see run.service.test.ts
 * which tests the service in isolation.
 */
describe('RunsController', () => {
  const mockCreate = vi.fn();
  const mockAuthContext = { userId: 'test-user', isSuperAdmin: false };
  const mockBody = {
    task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
    task_version: '1.0.0',
    administration_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(RunService).mockReturnValue({
      create: mockCreate,
    });
  });

  it('should export RunsController with create method', async () => {
    const { RunsController } = await import('./runs.controller');

    expect(RunsController).toBeDefined();
    expect(RunsController.create).toBeDefined();
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
});
