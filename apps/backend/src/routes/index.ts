import type { Express } from 'express';
import { Router } from 'express';
import { registerMeRoutes } from './me';
import { registerAgreementsRoutes } from './agreements';
import { registerAdministrationsRoutes } from './administrations';
import { registerRunsRoutes } from './runs';
import { registerDistrictsRoutes } from './districts';
import { registerSchoolsRoutes } from './schools';
import { registerGroupsRoutes } from './groups';
import { registerTasksRoutes } from './task';
import { registerTaskVariantsRoutes } from './task-variants';
import { registerTaskBundlesRoutes } from './task-bundles';
import { registerClassesRoutes } from './classes';
import { registerUserRoutes } from './users';
import { registerSystemRoutes } from './system';
import { API_VERSION } from '../constants/api';
import { API_ROUTES } from '../constants/api-routes';
import { version } from '../../package.json';
import { logger } from '../logger';

const router = Router();

/**
 * Route registration handler.
 *
 * Registers all routes on the provided app instance and mounts the router on the provided app instance.
 *
 * @param app - The app instance to register the routes on.
 */
export function registerAllRoutes(app: Express) {
  router.get(API_ROUTES.ROOT_PATH, (req, res) => {
    res.json({
      title: 'ROAR API',
      version,
    });
  });

  registerMeRoutes(router);
  registerAgreementsRoutes(router);
  registerAdministrationsRoutes(router);
  registerRunsRoutes(router);
  registerDistrictsRoutes(router);
  registerSchoolsRoutes(router);
  registerGroupsRoutes(router);
  registerTasksRoutes(router);
  registerTaskVariantsRoutes(router);
  registerTaskBundlesRoutes(router);
  registerClassesRoutes(router);
  registerUserRoutes(router);
  registerSystemRoutes(router);

  // Dynamically import and register test routes only in test mode to avoid bundling test dependencies
  if (process.env.NODE_ENV === 'test') {
    // Use dynamic import to keep test code out of production bundle.
    // Note: There is a small window (sub-millisecond) between router mounting and test route registration
    // where GET /v1/test/fixture returns 404. In practice, this is not an issue because the global setup
    // completes before getBaseFixtureData() is called. If flakiness appears, registerAllRoutes should be
    // made async and awaited in app.ts.
    import('./test')
      .then(({ registerTestRoutes }) => {
        registerTestRoutes(router);
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to register test routes');
      });
  }

  app.use(`/${API_VERSION.V1}`, router);
}
