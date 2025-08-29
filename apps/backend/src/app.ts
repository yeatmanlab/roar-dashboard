import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { isHttpError } from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { registerAllRoutes } from './routes';
import { API_ERROR_CODES } from './constants/api-error-codes';

const app = express();

app.use(express.json());

registerAllRoutes(app);

// Handle inexistent routes
app.use((_req: Request, res: Response) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: {
      message: 'Not found.',
      code: API_ERROR_CODES.REQUEST_INVALID,
    },
  });
});

// Handle errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Convert HTTP errors created within the application to JSON responses
  if (isHttpError(err)) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Fallback for unexpected errors
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      message: 'An unexpected error occurred.',
      code: API_ERROR_CODES.INTERNAL,
    },
  });
});

export default app;
