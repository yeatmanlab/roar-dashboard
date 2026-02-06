import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Mock the RunService module
vi.mock('../services/run/run.service', () => ({
  RunService: vi.fn(),
}));

import { RunService } from '../services/run/run.service';

describe('RunsController', () => {
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const mockAdminAuthContext = { userId: 'admin-456', isSuperAdmin: true };

  const validRequestBody = {
    task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
    task_version: '1.0.0',
    administration_id: '660e8400-e29b-41d4-a716-446655440001',
  };

  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreate = vi.fn();

    vi.mocked(RunService).mockReturnValue({
      create: mockCreate,
    });
  });

  describe('create', () => {
    it('should return 201 with run_id when run is created successfully', async () => {
      mockCreate.mockResolvedValue({ runId: 'run-uuid-123' });

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.CREATED);
      expect(result.body).toEqual({
        data: { run_id: 'run-uuid-123' },
      });
    });

    it('should pass auth context and request body to service', async () => {
      mockCreate.mockResolvedValue({ runId: 'run-uuid-456' });

      const { RunsController: Controller } = await import('./runs.controller');

      await Controller.create(mockAuthContext, validRequestBody);

      expect(mockCreate).toHaveBeenCalledWith(mockAuthContext, validRequestBody);
    });

    it('should return 400 when request validation fails', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Missing required fields', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
        task_version: '1.0.0',
        administration_id: '660e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect((result.body as { error: { message: string; code: string; traceId: string } }).error).toEqual({
        message: 'Missing required fields',
        code: 'request/validation-failed',
        traceId: expect.any(String),
      });
    });

    it('should return 404 when task variant is not found', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Task variant not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Task variant not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 404 when administration is not found', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect((result.body as { error: { message: string } }).error.message).toBe('Administration not found');
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to access this administration',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 500 when request validation fails with DATABASE_QUERY_FAILED', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Invalid request format', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect((result.body as { error: { message: string } }).error.message).toBe('Invalid request format');
    });

    it('should include traceId in error response', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Task variant not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect((result.body as { error: { traceId: string } }).error.traceId).toBeDefined();
      expect(typeof (result.body as { error: { traceId: string } }).error.traceId).toBe('string');
      expect((result.body as { error: { traceId: string } }).error.traceId.length).toBeGreaterThan(0);
    });

    it('should work for super admin users', async () => {
      mockCreate.mockResolvedValue({ runId: 'run-uuid-789' });

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAdminAuthContext, validRequestBody);

      expect(result.status).toBe(StatusCodes.CREATED);
      expect((result.body as { data: { run_id: string } }).data.run_id).toBe('run-uuid-789');
      expect(mockCreate).toHaveBeenCalledWith(mockAdminAuthContext, validRequestBody);
    });

    it('should create run with metadata', async () => {
      const bodyWithMetadata = {
        task_variant_id: '550e8400-e29b-41d4-a716-446655440000',
        task_version: '1.0.0',
        administration_id: '660e8400-e29b-41d4-a716-446655440001',
        metadata: { source: 'dashboard', sessionId: 'sess-123' },
      };

      mockCreate.mockResolvedValue({ runId: 'run-uuid-metadata' });

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, bodyWithMetadata);

      expect(result.status).toBe(StatusCodes.CREATED);
      expect(mockCreate).toHaveBeenCalledWith(mockAuthContext, bodyWithMetadata);
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockCreate.mockRejectedValue(unexpectedError);

      const { RunsController: Controller } = await import('./runs.controller');

      await expect(Controller.create(mockAuthContext, validRequestBody)).rejects.toThrow('Database connection lost');
    });

    it('should handle multiple error scenarios correctly', async () => {
      const { RunsController: Controller } = await import('./runs.controller');

      // Test BAD_REQUEST
      mockCreate.mockRejectedValueOnce(
        new ApiError('Missing fields', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );
      let result = await Controller.create(mockAuthContext, validRequestBody);
      expect(result.status).toBe(StatusCodes.BAD_REQUEST);

      // Test NOT_FOUND
      mockCreate.mockRejectedValueOnce(
        new ApiError('Not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );
      result = await Controller.create(mockAuthContext, validRequestBody);
      expect(result.status).toBe(StatusCodes.NOT_FOUND);

      // Test FORBIDDEN
      mockCreate.mockRejectedValueOnce(
        new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );
      result = await Controller.create(mockAuthContext, validRequestBody);
      expect(result.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should return response with correct structure', async () => {
      mockCreate.mockResolvedValue({ runId: 'test-run-id-12345' });

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('body');
      expect(result.body as { data: { run_id: string } }).toHaveProperty('data');
      expect((result.body as { data: { run_id: string } }).data).toHaveProperty('run_id');
      expect((result.body as { data: { run_id: string } }).data.run_id).toBe('test-run-id-12345');
    });

    it('should handle error response with correct structure', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Test error', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('body');
      expect(result.body as { error: { message: string; code: string; traceId: string } }).toHaveProperty('error');
      expect((result.body as { error: { message: string; code: string; traceId: string } }).error).toHaveProperty(
        'message',
      );
      expect((result.body as { error: { message: string; code: string; traceId: string } }).error).toHaveProperty(
        'code',
      );
      expect((result.body as { error: { message: string; code: string; traceId: string } }).error).toHaveProperty(
        'traceId',
      );
    });

    it('should preserve error code format in response', async () => {
      mockCreate.mockRejectedValue(
        new ApiError('Validation failed', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { RunsController: Controller } = await import('./runs.controller');

      const result = await Controller.create(mockAuthContext, validRequestBody);

      expect((result.body as { error: { code: string } }).error.code).toBe('request/validation-failed');
    });

    it('should handle service returning different runId formats', async () => {
      const { RunsController: Controller } = await import('./runs.controller');

      // Test with UUID format
      mockCreate.mockResolvedValueOnce({
        runId: '550e8400-e29b-41d4-a716-446655440000',
      });
      let result = await Controller.create(mockAuthContext, validRequestBody);
      expect((result.body as { data: { run_id: string } }).data.run_id).toBe('550e8400-e29b-41d4-a716-446655440000');

      // Test with different UUID
      mockCreate.mockResolvedValueOnce({
        runId: '660e8400-e29b-41d4-a716-446655440001',
      });
      result = await Controller.create(mockAuthContext, validRequestBody);
      expect((result.body as { data: { run_id: string } }).data.run_id).toBe('660e8400-e29b-41d4-a716-446655440001');
    });
  });
});
