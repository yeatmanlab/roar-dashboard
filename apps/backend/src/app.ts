import express from 'express';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { registerAllRoutes } from './routes';
import { errorHandler } from './error-handler';
import { API_ERROR_CODES } from './constants/api-error-codes';

const app = express();

app.use(express.json());

registerAllRoutes(app);

// Handle inexistent routes
app.use((_req: Request, res: Response) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: {
      message: 'Not found.',
      code: API_ERROR_CODES.REQUEST.INVALID,
    },
  });
});

// Handle errors
app.use(errorHandler);

export default app;
