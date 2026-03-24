/**
 * Assessment stage constants for trial events.
 *
 * These constants define the valid assessment stages that can be used when recording trial data.
 * The SDK normalizes both response and non-response variants to their base stage for backend compatibility.
 *
 * Input stages (from Firekit):
 * - ASSESSMENT_STAGE_PRACTICE: 'practice'
 * - ASSESSMENT_STAGE_PRACTICE_RESPONSE: 'practice_response'
 * - ASSESSMENT_STAGE_TEST: 'test'
 * - ASSESSMENT_STAGE_TEST_RESPONSE: 'test_response'
 *
 * Normalized output stages (to backend):
 * - 'practice' (from ASSESSMENT_STAGE_PRACTICE or ASSESSMENT_STAGE_PRACTICE_RESPONSE)
 * - 'test' (from ASSESSMENT_STAGE_TEST or ASSESSMENT_STAGE_TEST_RESPONSE)
 */

export const ASSESSMENT_STAGE_PRACTICE = 'practice' as const;
export const ASSESSMENT_STAGE_PRACTICE_RESPONSE = 'practice_response' as const;
export const ASSESSMENT_STAGE_TEST = 'test' as const;
export const ASSESSMENT_STAGE_TEST_RESPONSE = 'test_response' as const;
