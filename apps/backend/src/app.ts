import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { registerAllRoutes } from './routes';
import { errorHandler } from './error-handler';
import { requestLogger } from './middleware/request-logger/request-logger.middleware';
import { ApiErrorCode } from './enums/api-error-code.enum';

const app = express();

// In development, allow any localhost origin so assessment webpack dev servers (:8000)
// and the dashboard Vite dev server (:5173) can reach the backend without CORS errors.
// In production, callers are either same-origin or must supply ALLOWED_ORIGINS.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ALLOWED_ORIGINS_PROD = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin ?? '';
  const allowed =
    process.env.NODE_ENV !== 'production' ? LOCALHOST_ORIGIN.test(origin) : ALLOWED_ORIGINS_PROD.includes(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,baggage,sentry-trace');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(StatusCodes.NO_CONTENT);
    return;
  }

  next();
});

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
      message: 'Not found.',
      code: ApiErrorCode.REQUEST_INVALID,
    },
  });
});

// Handle errors
app.use(errorHandler);

export default app;
