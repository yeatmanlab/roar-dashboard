import { initContract } from '@ts-rest/core';
import { BackfillFgaQuerySchema, BackfillFgaResponseSchema } from './schema';
import { SuccessEnvelopeSchema, ErrorEnvelopeSchema } from '../response';

const c = initContract();

export const AdminContract = c.router(
  {
    backfillFga: {
      method: 'POST',
      path: '/authorization/backfill-fga',
      query: BackfillFgaQuerySchema,
      body: c.noBody(),
      responses: {
        200: SuccessEnvelopeSchema(BackfillFgaResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
    },
  },
  { pathPrefix: '/admin' },
);
