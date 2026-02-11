import { z } from 'zod';
import { SuccessEnvelopeSchema } from '../response';

/**
 * Invitation Code Schema
 *
 * Represents an invitation code that can be used to join a group.
 */
export const InvitationCodeSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  code: z.string(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable(),
  dates: z.object({
    created: z.string().datetime(),
    updated: z.string().datetime(),
  }),
});

export type InvitationCode = z.infer<typeof InvitationCodeSchema>;

/**
 * Response for getting a group's invitation code.
 */
export const GroupInvitationCodeResponseSchema = SuccessEnvelopeSchema(InvitationCodeSchema);

export type GroupInvitationCodeResponse = z.infer<typeof GroupInvitationCodeResponseSchema>;
