import { Router, type Express } from 'express'
import { registerUsersRoutes } from './users'
import { API_VERSION } from '../constants/api'
import { API_ROUTES } from '../constants/api-routes'
import { version } from '../../package.json'

const router = Router()

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
      version
    })
  })

  registerUsersRoutes(router)

  app.use(`/${API_VERSION.V1}`, router)
}