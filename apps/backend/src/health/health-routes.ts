import { Router } from 'express';
import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { runHealthChecks } from './health-checks';
import { isShuttingDown } from './shutdown-state';
import { logger } from '../logger';

export const healthRouter = Router();

/**
 * Runs health checks and sends the appropriate response.
 * Shared by the startup and readiness probes.
 *
 * @param res - Express response object
 */
async function respondWithHealthCheck(res: Response): Promise<void> {
  try {
    const result = await runHealthChecks();
    const status = result.status === 'ok' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    res.status(status).json(result);
  } catch (err) {
    logger.error({ err }, 'Unexpected error from runHealthChecks');
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ status: 'error' });
  }
}

/**
 * Liveness probe — confirms the process is running.
 * No dependency checks, no JSON body.
 */
healthRouter.get('/health/live', (_req, res) => {
  res.sendStatus(StatusCodes.OK);
});

/**
 * Startup probe — confirms all dependencies are reachable.
 * Returns 200 when all checks pass, 503 otherwise.
 */
healthRouter.get('/health/startup', async (_req, res) => {
  await respondWithHealthCheck(res);
});

/**
 * Readiness probe — confirms the instance can accept traffic.
 * Returns 503 immediately during graceful shutdown so Cloud Run
 * stops routing new requests to this instance.
 */
healthRouter.get('/health/ready', async (_req, res) => {
  if (isShuttingDown()) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ status: 'shutting_down' });
    return;
  }

  await respondWithHealthCheck(res);
});
