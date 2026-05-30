import express from 'express';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { registerAllRoutes } from './routes';
import { errorHandler } from './error-handler';
import { corsMiddleware } from './middleware/cors/cors.middleware';
import { securityHeadersMiddleware } from './middleware/security-headers/security-headers.middleware';
import { requestLogger } from './middleware/request-logger/request-logger.middleware';
import { ApiErrorCode } from './enums/api-error-code.enum';
import { ApiErrorMessage } from './enums/api-error-message.enum';

const app = express();

app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(requestLogger);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ status: 'ok' });
});

registerAllRoutes(app);

// Handle inexistent routes
app.use((_req: Request, res: Response) => {
  return res.status(StatusCodes.NOT_FOUND).json({
    error: {
      message: ApiErrorMessage.NOT_FOUND,
      code: ApiErrorCode.REQUEST_INVALID,
    },
  });
});

// Handle errors
app.use(errorHandler);

export default app;
