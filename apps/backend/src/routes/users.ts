import type { Router } from 'express';
import { initServer, createExpressEndpoints } from '@ts-rest/express';
import { StatusCodes } from 'http-status-codes';
import { UsersContract } from '@repo/api-contract';

import { eq } from 'drizzle-orm';
import { AppDbClient } from '../db/clients';
import { users } from '../db/schema';

const s = initServer();

// Mock controller
// @TODO: Remove this mock controller and replace with actual implementation once ready.
const UserController = {
  getById: async ({ params: { id } }: { params: { id: string } }) => {
    const [user] = await AppDbClient.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      return { status: StatusCodes.NOT_FOUND as const, body: { error: { message: 'User not found' } } };
    }

    return {
      status: StatusCodes.OK as const,
      body: {
        data: {
          id: user.id,
          auth_id: user.authId,
          ...(user.email != null ? { email: user.email } : {}),
          ...(user.username != null ? { username: user.username } : {}),
        }
      }
    };
  },
};

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
      handler: UserController.getById,
    },
  });

  createExpressEndpoints(UsersContract, UsersRoutes, routerInstance);
}
