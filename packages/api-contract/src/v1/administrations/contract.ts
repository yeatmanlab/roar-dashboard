import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  AdministrationBaseSchema,
  AdministrationsListQuerySchema,
  AdministrationsListResponseSchema,
  AdministrationDistrictsListQuerySchema,
  AdministrationDistrictsListResponseSchema,
  AdministrationSchoolsListQuerySchema,
  AdministrationSchoolsListResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /administrations endpoints.
 * Provides access to administrations the authenticated user can view.
 */
export const AdministrationsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/',
      query: AdministrationsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationsListResponseSchema),
        401: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List administrations',
      description:
        'Returns a paginated list of administrations the authenticated user has access to. ' +
        'Use ?status=active|past|upcoming to filter by date status. ' +
        'Use ?embed=stats to include assignment stats. Use ?embed=tasks to include task variants.',
    },
    get: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: SuccessEnvelopeSchema(AdministrationBaseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get administration by ID',
      description:
        'Returns a single administration by ID. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listDistricts: {
      method: 'GET',
      path: '/:id/districts',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationDistrictsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationDistrictsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List districts assigned to an administration',
      description:
        'Returns a paginated list of districts assigned to the specified administration. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listSchools: {
      method: 'GET',
      path: '/:id/schools',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationSchoolsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationSchoolsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List schools assigned to an administration',
      description:
        'Returns a paginated list of schools assigned to the specified administration. ' +
        'Supervisory users see only schools in their accessible org tree. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
  },
  { pathPrefix: '/administrations' },
);
