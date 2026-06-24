import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';
import {
  ClassDetailSchema,
  CreateClassRequestSchema,
  CreateClassResponseSchema,
  UpdateClassRequestSchema,
  UpdateClassResponseSchema,
} from './schema';

const c = initContract();

/**
 * Contract for the /classes endpoints.
 * Provides access to classes the authenticated user can view.
 */
export const ClassesContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: CreateClassRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateClassResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        422: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a class',
      description:
        'Creates a new class under an existing school. ' +
        'The parent schoolId lives in the request body, not the URL — every canonical resource on this API sits at the top level. ' +
        "districtId is derived server-side from the school's parent org. " +
        "The class's ltree orgPath is computed from the parent school's path by a database trigger. " +
        'schoolLevels is computed from grades by a generated column. ' +
        'Restricted to super admins. ' +
        'Returns 201 with the new class id. ' +
        'Returns 400 if the request body is missing or contains invalid field values. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 422 if schoolId is well-formed but does not resolve to an active school (no row, wrong orgType, or rosteringEnded set in the past). ' +
        'Returns 500 if an internal server error occurs.',
    },
    get: {
      method: 'GET',
      path: '/:classId',
      pathParams: z.object({
        classId: z.string().uuid(),
      }),
      responses: {
        200: SuccessEnvelopeSchema(ClassDetailSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get class by ID',
      description:
        'Returns a single class by ID. ' +
        'Super admins can read any class. A class is also readable by supervisory members of the class itself ' +
        '(administrators, principals, counselors, teachers, aides, proctors) and — through org-hierarchy inheritance — ' +
        'by admins and principals of the ancestor school or district. ' +
        'Students and caregivers receive 403. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 404 if the class does not exist. ' +
        'Returns 500 if an internal server error occurs.',
    },
    update: {
      method: 'PATCH',
      path: '/:classId',
      pathParams: z.object({
        classId: z.string().uuid(),
      }),
      body: UpdateClassRequestSchema,
      responses: {
        200: SuccessEnvelopeSchema(UpdateClassResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Update a class',
      description:
        'Updates an existing class. Only the mutable fields present in the request body are applied ' +
        '(name, classType, subjects, grades, location); identity and hierarchy fields ' +
        '(id, schoolId, districtId, orgPath) cannot change and are rejected — a class cannot be moved ' +
        'to a different school or district. Updating grades recomputes the generated schoolLevels column. ' +
        'Restricted to super admins. ' +
        'Returns 200 with the updated class id. ' +
        'Returns 400 if the body is malformed or contains no recognized mutable fields. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 404 if the class does not exist. ' +
        'Returns 500 if an internal server error occurs.',
    },
    listUsers: {
      method: 'GET',
      path: '/:classId/users',
      pathParams: z.object({ classId: z.string().uuid() }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get class users by classId',
      description:
        'Returns a paginated list of active users in a class. ' +
        'Filters users by role and grade if provided. ' +
        'Returns 403 if the user lacks permission to access the class. ' +
        'Returns 404 if the class does not exist.',
    },
  },
  { pathPrefix: '/classes' },
);
