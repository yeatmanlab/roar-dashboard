/**
 * API Routes
 *
 * Routes are organized around top-level resources (e.g. `/users`).  Each resource has a base path (the prefix) and may
 * define sub-paths relative to that base.
 *
 * Example:
 *   - USERS.PREFIX = '/users'
 *   - USERS.BY_ID = '/:id'   // resolves to '/users/:id'
 *
 * This structure mirrors the API contract definitions, where each resource is represented by a distinct prefix.
 */
export const API_ROUTES = {
  // Generic root path
  ROOT_PATH: '/',
  
  // Users routes
  USERS: {
    PREFIX: '/users',
    BY_ID: '/:id',
  }
} as const
