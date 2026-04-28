import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';
import {
  UserResponseSchema,
  UpdateUserRequestBodySchema,
  RecordUserAgreementRequestBodySchema,
  RecordUserAgreementResponseSchema,
} from './schema';
import { GuardianStudentReportContract } from './reports/scores/index';

const c = initContract();

/**
 * Contract for the /users endpoints.
 * Provides access to user related data that an authenticated user can view.
 * Provides the ability to update user profile data for authorized users.
 * Provides the ability to manage user agreements (consent records).
 */
export const UsersContract = c.router(
  {
    get: {
      method: 'GET',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: SuccessEnvelopeSchema(UserResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get a user by ID',
      description:
        'Returns a single user by their ID. ' +
        ' Returns a 401 if the requesting user is not authenticated. ' +
        ' Returns a 403 if the requesting user is not authorized to view the requested user. ' +
        ' Returns a 404 if the requested user is not found. ' +
        ' Returns a 500 if an internal server error occurs.',
    },
    update: {
      method: 'PATCH',
      path: '/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      contentType: 'application/json',
      body: UpdateUserRequestBodySchema,
      responses: {
        204: z.undefined(),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Update a user by ID',
      description:
        'Partially updates a user by their ID. ' +
        'Only the fields present in the request body are updated — omitted fields are left unchanged. ' +
        'Nullable fields may be explicitly set to null to clear their value. ' +
        'Returns a 204 No Content on success. ' +
        'Returns a 400 if the request body is missing or contains invalid field values. ' +
        'Returns a 401 if the requesting user is not authenticated. ' +
        'Returns a 403 if the requesting user is not authorized to update the requested user. ' +
        'Returns a 404 if the requested user is not found. ' +
        'Returns a 409 if a unique field (email or username) conflicts with an existing user. ' +
        'Returns a 500 if an internal server error occurs.',
    },
    recordUserAgreement: {
      method: 'POST',
      path: '/:userId/agreements',
      pathParams: z.object({
        userId: z.string().uuid(),
      }),
      body: RecordUserAgreementRequestBodySchema,
      responses: {
        201: SuccessEnvelopeSchema(RecordUserAgreementResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        409: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Record user agreement',
      description:
        "Records a user's consent to a specific agreement version. " +
        'Users can consent for themselves, and guardians can consent for family members. ' +
        'Returns 201 Created with the agreement ID. ' +
        'Returns 400 if the request body is invalid. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user lacks permission to consent for the target user. ' +
        'Returns 404 if the user or agreement version does not exist. ' +
        'Returns 409 if the user has already consented to the given agreement version. ' +
        'Returns 500 if an internal server error occurs.',
    },
    // Nest guardian / longitudinal score report sub-router under /users
    scoreReports: GuardianStudentReportContract,
  },
  { pathPrefix: '/users' },
);
