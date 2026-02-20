import express from 'express';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { registerAllRoutes } from './routes';
import { errorHandler } from './error-handler';
import { requestLogger } from './middleware/request-logger/request-logger.middleware';
import { ApiErrorCode } from './enums/api-error-code.enum';

const app = express();

app.use(requestLogger);
app.use(express.json());

registerAllRoutes(app);

// Handle inexistent routes
app.use((_req: Request, res: Response) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: {
      message: 'Not found.',
      code: ApiErrorCode.REQUEST_INVALID,
    },
  });
});

// Handle errors
app.use(errorHandler);

export default app;
