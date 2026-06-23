import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  CreateGroupRequestSchema,
  CreateGroupResponseSchema,
  GroupDetailSchema,
  GroupsListQuerySchema,
  GroupsListResponseSchema,
  InvitationCodeSchema,
} from './schema';
import { EnrolledUsersQuerySchema, EnrolledUsersResponseSchema } from '../common/user';
import { ErrorEnvelopeSchema, SuccessEnvelopeSchema } from '../response';

const c = initContract();

/**
 * Contract for the /groups endpoints.
 */
export const GroupsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/',
      body: CreateGroupRequestSchema,
      responses: {
        201: SuccessEnvelopeSchema(CreateGroupResponseSchema),
        400: ErrorEnvelopeSchema,
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Create a group',
      description:
        'Creates a new group. Groups are flat, non-hierarchical entities used for ad-hoc cohorts and research panels — they have no parent and no ltree path. ' +
        'Restricted to super admins. ' +
        'Returns 201 with the new group id. ' +
        'Returns 400 if the request body is missing or contains invalid field values. ' +
        'Returns 401 if the user is not authenticated. ' +
        'Returns 403 if the user is not a super admin. ' +
        'Returns 500 if an internal server error occurs.',
    },
    list: {
      method: 'GET',
      path: '/',
      query: GroupsListQuerySchema,
      responses: {
        200: SuccessEnvelopeSchema(GroupsListResponseSchema),
        401: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'List groups',
      description:
        'Returns a paginated list of groups the authenticated user has access to. ' +
        'Super admins can access all groups. Regular users only see groups they belong to in a supervisory role. ' +
        'Unauthorized users receive an empty result set (not a 403 error). ' +
        'Use ?includeEnded=true to include groups with a rosteringEnded timestamp.',
    },
    get: {
      method: 'GET',
      path: '/:groupId',
      pathParams: z.object({
        groupId: z.string().uuid(),
      }),
      responses: {
        200: SuccessEnvelopeSchema(GroupDetailSchema),
        401: ErrorEnvelopeSchema,
        403: ErrorEnvelopeSchema,
        404: ErrorEnvelopeSchema,
        500: ErrorEnvelopeSchema,
      },
      strictStatusCodes: true,
      summary: 'Get group by ID',
      description:
        'Returns a single group by ID. ' +
        'Super admins can access any group. Regular users can only access groups they belong to in a supervisory role.',
    },
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
        200: SuccessEnvelopeSchema(EnrolledUsersResponseSchema),
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
