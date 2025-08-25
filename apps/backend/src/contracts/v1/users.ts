import { z } from 'zod'
import { initContract } from '@ts-rest/core'
// import { ResponseSchema } from '../response'
import { API_ROUTES } from '../../constants/api-routes'

const c = initContract()

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email()
})

export const UsersContract = c.router(
  {
    getById: {
      method: 'GET',
      path: API_ROUTES.USERS.BY_ID,
      pathParams: z.object({
        id: z.string(),
      }),
      responses: { 
        200: UserSchema, 
        404: z.object({
          message: z.string()
        })
      },
      strictStatusCodes: true,
    },
  },
  { pathPrefix: API_ROUTES.USERS.PREFIX }
)