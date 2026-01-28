/**
 * Firekit-compatible input for appkit.writeTrial
 * Matches: writeTrial(trialData: TrialData, computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>)
 */

// Trial data structure from Firekit
export interface TrialData {
  [key: string]: unknown;
}

// Raw scores passed to the callback
export interface RawScores {
  [key: string]: unknown;
}

// Computed scores returned from the callback
export interface ComputedScores {
  [key: string]: unknown;
}

export interface WriteTrialInput {
  trialData: TrialData;
  computedScoreCallback?: (rawScores: RawScores) => Promise<ComputedScores>;
}

export type WriteTrialOutput = Promise<void>;
