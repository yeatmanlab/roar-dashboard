import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from './request-logger.middleware';

vi.mock('../../logger', () => {
  const mockChild = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    logger: {
      child: vi.fn(() => mockChild),
    },
  };
});

// Import after mocking to get the mocked version
import { logger } from '../../logger';

describe('requestLogger', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let finishHandler: () => void;
  let mockChildLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Get reference to the mocked child logger
    mockChildLogger = (logger.child as ReturnType<typeof vi.fn>)();

    mockReq = {
      method: 'GET',
      originalUrl: '/api/users',
      path: '/api/users',
      headers: {
        'x-request-id': 'test-request-id',
        'content-type': 'application/json',
      },
      ip: '127.0.0.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
    };

    mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
        return mockRes as Response;
      }),
    };

    mockNext = vi.fn();
  });

  describe('excluded routes', () => {
    it('should skip logging for /health route', () => {
      const healthReq = { ...mockReq, path: '/health' };

      requestLogger(healthReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).not.toHaveBeenCalled();
    });

    it('should skip logging for /ready route', () => {
      const readyReq = { ...mockReq, path: '/ready' };

      requestLogger(readyReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).not.toHaveBeenCalled();
    });
  });

  describe('log levels based on status code', () => {
    it('should log at info level for 2xx responses', () => {
      mockRes.statusCode = 200;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      expect(mockChildLogger.info).toHaveBeenCalled();
      expect(mockChildLogger.warn).not.toHaveBeenCalled();
      expect(mockChildLogger.error).not.toHaveBeenCalled();
    });

    it('should log at info level for 3xx responses', () => {
      mockRes.statusCode = 301;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      expect(mockChildLogger.info).toHaveBeenCalled();
      expect(mockChildLogger.warn).not.toHaveBeenCalled();
      expect(mockChildLogger.error).not.toHaveBeenCalled();
    });

    it('should log at warn level for 4xx responses', () => {
      mockRes.statusCode = 404;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      expect(mockChildLogger.warn).toHaveBeenCalled();
      expect(mockChildLogger.info).not.toHaveBeenCalled();
      expect(mockChildLogger.error).not.toHaveBeenCalled();
    });

    it('should log at error level for 5xx responses', () => {
      mockRes.statusCode = 500;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      expect(mockChildLogger.error).toHaveBeenCalled();
      expect(mockChildLogger.info).not.toHaveBeenCalled();
      expect(mockChildLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('log data structure', () => {
    it('should include all expected fields in log data', () => {
      mockRes.statusCode = 200;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      const logCall = mockChildLogger.info.mock.calls[0]!;
      const logData = logCall[0];
      const logMessage = logCall[1];

      expect(logData).toMatchObject({
        version: expect.any(String),
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/users',
        status: 200,
        durationMs: expect.any(Number),
        req: {
          headers: expect.any(Object),
          remoteAddress: '127.0.0.1',
          httpVersion: '1.1',
        },
      });

      expect(logMessage).toMatch(/GET \/api\/users 200 \d+(\.\d+)?ms/);
    });

    it('should handle missing x-request-id header', () => {
      mockReq.headers = { 'content-type': 'application/json' };
      mockRes.statusCode = 200;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      const logData = mockChildLogger.info.mock.calls[0]![0];
      expect(logData.requestId).toBeUndefined();
    });

    it('should include HTTP/2 version when applicable', () => {
      mockReq.httpVersionMajor = 2;
      mockReq.httpVersionMinor = 0;
      mockRes.statusCode = 200;

      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishHandler();

      const logData = mockChildLogger.info.mock.calls[0]![0];
      expect(logData.req.httpVersion).toBe('2.0');
    });
  });

  describe('middleware behavior', () => {
    it('should call next() for non-excluded routes', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event handler', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});
