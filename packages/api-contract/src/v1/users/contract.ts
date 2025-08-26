import { z } from 'zod'
import { initContract } from '@ts-rest/core'
import { User } from './schema.js'
import { NotFound } from '../common/http.js'

const c = initContract()

export const UsersContract = c.router(
  {
    getById: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({
        id: z.string(),
      }),
      responses: { 
        200: User, 
        404: NotFound,
      },
      strictStatusCodes: true,
    },
  },
  { pathPrefix: '/users' }
)