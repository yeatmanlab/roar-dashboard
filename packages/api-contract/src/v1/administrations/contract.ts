import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  AdministrationBaseSchema,
  AdministrationsListQuerySchema,
  AdministrationsListResponseSchema,
  AdministrationAssigneesResponseSchema,
  AdministrationTaskVariantsListQuerySchema,
  AdministrationTaskVariantsListResponseSchema,
  AdministrationAgreementsListQuerySchema,
  AdministrationAgreementsListResponseSchema,
  AdministrationTreeQuerySchema,
  AdministrationTreeResponseSchema,
  CreateAdministrationRequestSchema,
  CreateAdministrationResponseSchema,
  UpdateAdministrationRequestSchema,
  UpdateAdministrationResponseSchema,
} from './schema';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { ProgressReportsContract } from './reports/progress/index';
import { ScoreReportsContract } from './reports/scores/index';

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
    create: {
      method: 'POST',
      path: '/',
      body: CreateAdministrationRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateAdministrationResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create an administration',
      description:
        'Creates a new administration with the specified task variants and entity assignments. ' +
        'Validates that dateEnd is after dateStart, at least one task variant is provided, ' +
        'and all referenced entities (orgs, classes, groups, task variants, agreements) exist. ' +
        'When isOrdered is true, task variants must have unique orderIndex values. ' +
        'At least one org, class, or group must be assigned. ' +
        'Returns 422 for validation errors (invalid date range, duplicate orderIndex, missing orgs/classes/groups, missing assignments), ' +
        '409 if an administration with the same name already exists, ',
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
    getAssignees: {
      method: 'GET',
      path: '/:id/assignees',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: SuccessEnvelopeSchema(AdministrationAssigneesResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get entities directly assigned to an administration',
      description:
        'Returns entities directly assigned to the administration via junction tables, ' +
        'grouped into districts, schools, classes, and groups. ' +
        'No pagination — administrations are assigned to a small number of entities. ' +
        'Schools include parentOrgId, classes include schoolId and districtId for hierarchy. ' +
        'Super admins only. ' +
        'Returns 403 if the user is not a super admin. ' +
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
        'Supervisory roles (teachers, admins) see all variants (including draft/deprecated) with raw conditions for client-side evaluation. ' +
        'Supervised roles (students) see only published variants, filtered by eligibility - ' +
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
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration does not exist.',
    },
    getTree: {
      method: 'GET',
      path: '/:id/tree',
      pathParams: z.object({ id: z.string().uuid() }),
      query: AdministrationTreeQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(AdministrationTreeResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get one level of the organization tree for an administration',
      description:
        'Returns a paginated list of entities at one level of the organization hierarchy ' +
        'for a specific administration. Use parentEntityType and parentEntityId to navigate ' +
        'deeper into the tree. When omitted, returns all direct assignees (districts, schools, classes, and groups). ' +
        'Use ?embed=stats to include assignment statistics per node. ' +
        'Results are scoped to entities the authenticated user has access to. ' +
        'Returns 400 if parentEntityId or parentEntityType is provided without the other. ' +
        'Returns 403 if the user lacks permission to access the administration. ' +
        'Returns 404 if the administration or parent entity does not exist.',
    },
    delete: {
      method: 'DELETE',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        204: z.undefined(),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Delete an administration',
      description:
        'Permanently deletes an administration and all associated assignments (orgs, classes, groups, task variants, agreements). ' +
        'Returns 204 on success. ' +
        'Returns 403 if the user lacks permission to delete the administration. ' +
        'Returns 404 if the administration does not exist. ' +
        'Returns 409 if the administration has existing assessment runs that must be preserved.',
    },
    update: {
      method: 'PATCH',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateAdministrationRequestSchema,
      responses: {
        200: SuccessEnvelopeSchema(UpdateAdministrationResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Update an administration',
      description:
        'Updates an existing administration with the specified fields. ' +
        'Only fields present in the request body are updated. ' +
        'Array fields (orgs, classes, groups, taskVariants, agreements) use replacement logic: ' +
        'records not in the new array are deleted, existing records are updated, new records are added. ' +
        'Validates that dateEnd is after dateStart (using existing values for missing fields), ' +
        'at least one task variant exists after update, and all referenced entities exist. ' +
        'When isOrdered is true, task variants must have unique orderIndex values. ' +
        'At least one org, class, or group must remain assigned. ' +
        'Returns 422 for validation errors, 409 if the new name conflicts with another administration, ' +
        '403 if the user lacks permission, 404 if the administration does not exist.',
    },
    // Nest report sub-routers under /administrations
    progressReports: ProgressReportsContract,
    scoreReports: ScoreReportsContract,
  },
  { pathPrefix: '/administrations' },
);
