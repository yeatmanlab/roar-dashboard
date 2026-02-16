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
  AdministrationClassesListQuerySchema,
  AdministrationClassesListResponseSchema,
  AdministrationGroupsListQuerySchema,
  AdministrationGroupsListResponseSchema,
  AdministrationTaskVariantsListQuerySchema,
  AdministrationTaskVariantsListResponseSchema,
  AdministrationAgreementsListQuerySchema,
  AdministrationAgreementsListResponseSchema,
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
        'Super admins see all assigned districts. ' +
        'Supervisory users (administrator, teacher) see only districts in their accessible org tree. ' +
        'Supervised users (student, guardian, parent, relative) receive 403. ' +
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
        'Super admins see all assigned schools. ' +
        'Supervisory users (administrator, teacher) see only schools in their accessible org tree. ' +
        'Supervised users (student, guardian, parent, relative) receive 403. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listClasses: {
      method: 'GET',
      path: '/:id/classes',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationClassesListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationClassesListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List classes assigned to an administration',
      description:
        'Returns a paginated list of classes assigned to the specified administration. ' +
        'Super admins see all assigned classes. ' +
        'Supervisory users (administrator, teacher) see only classes in their accessible org tree. ' +
        'Supervised users (student, guardian, parent, relative) receive 403. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listGroups: {
      method: 'GET',
      path: '/:id/groups',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationGroupsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationGroupsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List groups assigned to an administration',
      description:
        'Returns a paginated list of groups assigned to the specified administration. ' +
        'Super admins see all assigned groups. ' +
        'Supervisory users (administrator, teacher) see only groups they are members of. ' +
        'Supervised users (student, guardian, parent, relative) receive 403. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listTaskVariants: {
      method: 'GET',
      path: '/:id/task-variants',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationTaskVariantsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationTaskVariantsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List task variants assigned to an administration',
      description:
        'Returns a paginated list of task variants assigned to the specified administration. ' +
        'Supervisory roles (teachers, admins) receive raw conditions for client-side evaluation. ' +
        'Supervised roles (students) receive filtered results with pre-evaluated optional flags - ' +
        'only variants where assigned_if passes are returned, and optional is set based on optional_if. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    listAgreements: {
      method: 'GET',
      path: '/:id/agreements',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationAgreementsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationAgreementsListResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List agreements assigned to an administration',
      description:
        'Returns a paginated list of agreements assigned to the specified administration. ' +
        'Each agreement includes the current version for the requested locale (default: en-US). ' +
        'Use ?locale=es or ?locale=es-MX for other locales (BCP-47 format). ' +
        'Use ?agreementType=tos|assent|consent to filter by agreement type. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
  },
  { pathPrefix: '/administrations' },
);
