import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { User } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

export const UsersContract = c.router(
  {
    getById: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({
        id: z.string().uuid(),
      }),
      responses: {
        200: SuccessEnvelopeSchema(User),
        404: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
    },
  },
  { pathPrefix: '/users' },
);
