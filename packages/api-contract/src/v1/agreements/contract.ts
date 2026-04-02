import { initContract } from '@ts-rest/core';
import { AgreementsListQuerySchema, AgreementsListResponseSchema } from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /agreements endpoints.
 * Provides access to legal agreement metadata for consent workflows.
 */
export const AgreementsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: AgreementsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AgreementsListResponseSchema),
        401: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List agreements',
      description:
        'Returns a paginated list of legal agreements filtered to those with a current version ' +
        'in the requested locale (default: en-US). ' +
        'Each agreement includes the current version metadata (GitHub references) for that locale. ' +
        'Use ?agreementType=consent|assent|tos to filter by type. ' +
        'Use ?locale=es-MX for other locales (BCP-47 format). ' +
        'Use ?embed=versions to include all historical versions for each agreement. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 500 if the database query fails.',
    },
  },
  { pathPrefix: '/agreements' },
);
