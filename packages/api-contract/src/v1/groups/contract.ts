import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GroupInvitationCodeResponseSchema } from './schema';
import { ErrorEnvelopeSchema } from '../response';

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
        200: GroupInvitationCodeResponseSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get group invitation code',
      description:
        'Returns the latest valid invitation code for a group. ' +
        'Super admins can access any group. ' +
        'Returns 403 if user is not a super admin. ' +
        'Returns 404 if no valid invitation code exists.',
    },
  },
  { pathPrefix: '/groups' },
);
