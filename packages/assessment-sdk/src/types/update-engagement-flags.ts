/**
 * Firekit-compatible input for appkit.updateEngagementFlags
 * Matches: updateEngagementFlags(flagNames: string[], markAsReliable = false, reliableByBlock = undefined)
 */
export interface UpdateEngagementFlagsInput {
  flagNames: string[];
  markAsReliable?: boolean;
  reliableByBlock?: Record<string, boolean>;
}

export type UpdateEngagementFlagsOutput = Promise<void>;
