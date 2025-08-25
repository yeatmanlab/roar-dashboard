import type { Router } from 'express'
import { initServer, createExpressEndpoints } from '@ts-rest/express'
import { StatusCodes } from 'http-status-codes'
import { UsersContract } from '../contracts/v1/users'

const s = initServer()

// Mock controller
// @TODO: Remove this mock controller and replace with actual implementation once ready.
const UserController = {
  getById: async ({ params: { id } }: { params: { id: string } }) => {
    const mockUser = { 
      id: '1',
      name: 'ROAR Test User',
      email: 'roar@roar.edu'
    }

    if (id !== '1') {
      return { status: StatusCodes.NOT_FOUND as const, body: { message: 'User not found' } }
    }

    return {
      status: StatusCodes.OK as const,
      body: mockUser
    }
  },
}


/**
 * Users routes registration handler.
 * 
 * Registers the users routes on the provided router instance using the provided contract.
 * 
 * @param routerInstance - The router instance to register the routes on.
 */
export function registerUsersRoutes(routerInstance: Router) {
  const UsersRoutes = s.router(UsersContract, {
    getById: {
      middleware: [],
      handler: UserController.getById
    },
  })

  createExpressEndpoints(UsersContract, UsersRoutes, routerInstance)
}