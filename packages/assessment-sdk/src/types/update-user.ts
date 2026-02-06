/**
 * Firekit-compatible input for appkit.updateUser
 * Matches: updateUser({ tasks, variants, assessmentPid, ...userMetadata }: UserUpdateInput)
 */
export interface UpdateUserInput {
  tasks?: string[];
  variants?: string[];
  assessmentPid?: string;
  [key: string]: unknown; // For userMetadata spread
}

export type UpdateUserOutput = Promise<void>;
