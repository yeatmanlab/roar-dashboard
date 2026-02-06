/**
 * Firekit-compatible input for appkit.updateUser
 * Matches: updateUser({ tasks, variants, assessmentPid, ...userMetadata }: UserUpdateInput)
 */
export interface UpdateUserInput {
  tasks?: string[];
  variants?: string[];
  assessmentPid?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateUserOutput = Promise<void>;
