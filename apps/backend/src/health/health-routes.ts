import { Router } from 'express';
import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { runReadinessChecks } from './health-checks';
import { isShuttingDown } from './shutdown-state';
import { logger } from '../logger';

export const healthRouter = Router();

/**
 * Runs readiness checks and sends the appropriate response.
 * Used only by the readiness probe.
 *
 * @param res - Express response object
 */
async function respondWithReadinessCheck(res: Response): Promise<void> {
  try {
    const result = await runReadinessChecks();
    const status = result.status === 'ok' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    res.status(status).json(result);
  } catch (err) {
    logger.error({ err }, 'Unexpected error from runReadinessChecks');
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'error',
      checks: { postgres: 'error', openfga: 'error' },
    });
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
 * Startup probe — confirms the process has started.
 * No dependency checks — external service outages should not
 * kill and restart the container. Dependency checks belong in
 * the readiness probe.
 */
healthRouter.get('/health/startup', (_req, res) => {
  res.sendStatus(StatusCodes.OK);
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

  await respondWithReadinessCheck(res);
});
