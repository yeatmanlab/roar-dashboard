/**
 * Assessment stage constants for trial events.
 *
 * These constants define the valid assessment stages that can be used when recording trial data.
 * The SDK normalizes both response and non-response variants to their base stage for backend compatibility.
 */

export const ASSESSMENT_STAGE_PRACTICE = 'practice' as const;
export const ASSESSMENT_STAGE_PRACTICE_RESPONSE = 'practice_response' as const;
export const ASSESSMENT_STAGE_TEST = 'test' as const;
export const ASSESSMENT_STAGE_TEST_RESPONSE = 'test_response' as const;

/**
 * Normalized assessment stage constants (backend format).
 * These are the values that the backend expects.
 */
export const NORMALIZED_ASSESSMENT_STAGE_PRACTICE = 'practice' as const;
export const NORMALIZED_ASSESSMENT_STAGE_TEST = 'test' as const;
