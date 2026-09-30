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
import { healthRouter } from './health/health-routes';

const TRUSTED_PROXY_HOPS = 1;
const AUTH_JSON_BODY_LIMIT = '16kb';

const app = express();

// Deployment invariant: the external load balancer is the one trusted hop and
// direct Cloud Run ingress must be disabled in roar-iac. The application repo
// cannot enforce that network boundary; changing the topology requires changing
// this value and its forwarded-IP tests together.
app.set('trust proxy', TRUSTED_PROXY_HOPS);

// requestLogger is registered first so every request is logged — including CORS preflight
// (OPTIONS), which corsMiddleware short-circuits with a 204 before later middleware run.
app.use(requestLogger);
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
// Public auth requests are intentionally tiny. Parse them with a narrow ceiling
// before the legacy 1 MiB parser so unauthenticated callers cannot force a large
// JSON parse before reaching the route-level rate limiter.
app.use('/v1/auth', express.json({ limit: AUTH_JSON_BODY_LIMIT }));
// Mirror the ~1 MiB per-document ceiling of the legacy Firestore write path (which bypassed
// this backend) rather than Express's 100 KB default, so clients sized against Firestore keep
// working. Express skips this parser when the auth-scoped parser already populated req.body.
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);

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
