import { initContract } from '@ts-rest/core';
import { SyncFgaQuerySchema, SyncFgaResponseSchema, SyncFgaAcceptedSchema } from './schema';
import { SuccessEnvelopeSchema, ErrorEnvelopeSchema } from '../response';

const c = initContract();

export const SystemContract = c.router(
  {
    syncFga: {
      method: 'POST',
      path: '/authorization/sync-fga',
      query: SyncFgaQuerySchema,
      body: c.noBody(),
      responses: {
        200: SuccessEnvelopeSchema(SyncFgaResponseSchema),
        202: SuccessEnvelopeSchema(SyncFgaAcceptedSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
    },
  },
  { pathPrefix: '/system' },
);
