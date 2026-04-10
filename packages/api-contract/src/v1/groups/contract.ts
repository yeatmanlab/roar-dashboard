import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { InvitationCodeSchema } from './schema';
import { EnrolledUsersQuerySchema, EnrolledOrgUsersResponseSchema } from '../common/user';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /groups endpoints.
 */
export const GroupsContract = c.router(
  {
    getInvitationCode: {
      method: 'GET',
      path: '/:groupId/invitation-code',
      pathParams: z.object({
        groupId: z.string().uuid(),
      }),
      responses: {
        200: SuccessEnvelopeSchema(InvitationCodeSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get group invitation code',
      description:
        'Returns the latest valid invitation code for a group. ' +
        'Super admins can access any group. ' +
        'Returns 403 if user is not a super admin. ' +
        'Returns 404 if no valid invitation code exists.',
    },
    listUsers: {
      method: 'GET',
      path: '/:groupId/users',
      pathParams: z.object({ groupId: z.string().uuid() }),
      query: EnrolledUsersQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(EnrolledOrgUsersResponseSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get group users by groupId',
      description:
        'Returns a paginated list of active users in a group. ' +
        'Filters users by role and grade if provided. ' +
        'Returns 403 if the user lacks permission to access the group. ' +
        'Returns 404 if the group does not exist.',
    },
  },
  { pathPrefix: '/groups' },
);
