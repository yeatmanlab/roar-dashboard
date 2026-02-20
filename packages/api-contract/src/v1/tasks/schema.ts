import { z } from 'zod';
import { JsonValue, parseJsonB } from '../common/parse-jsonb';
import { IDENTIFIER_WITH_HYPHENS, IDENTIFIER_WITH_UNDERSCORES } from '../common/regex';

export const TaskVariantStatusSchema = z.enum(['draft', 'published', 'deprecated']);

/**
 * Task Variant Parameter Schema
 *
 * Represents a single configuration parameter for a task variant.
 * Parameters can be optional - use `null` values to indicate unset/not applicable parameters.
 *
 * @property name - Parameter identifier (alphanumeric, starts with letter, max 255 chars)
 * @property value - Parameter value (string, number, null, array, or object)
 *
 * @example
 * // Simple string parameter
 * { "name": "difficulty", "value": "hard" }
 *
 * @example
 * // Numeric parameter
 * { "name": "timeLimit", "value": 60 }
 *
 * @example
 * // Boolean parameter
 * { "name": "shuffleItems", "value": true }
 *
 * @example
 * // Optional/unset parameter
 * { "name": "hints", "value": null }
 *
 * @example
 * // Array of stimuli
 * { "name": "wordList", "value": ["cat", "dog", "bird"] }
 *
 * @example
 * // Complex configuration object
 * {
 *   "name": "config",
 *   "value": {
 *     "mode": "adaptive",
 *     "startingLevel": 1,
 *     "enableAudio": false,
 *     "maxAttempts": null,
 *     "feedbackEnabled": null
 *   }
 * }
 */
const TaskVariantParameterSchema = z.object({
  name: z.string().min(1).max(255).regex(IDENTIFIER_WITH_UNDERSCORES),
  value: JsonValue.superRefine((value, ctx) => {
    parseJsonB(value, ctx);
  }),
});

/**
 * Task Variant Parameters Array Schema
 *
 * An array of parameter objects that configure a task variant.
 * At least one parameter is required. Parameters can have null values if optional.
 *
 * @example
 * [
 *   { "name": "difficulty", "value": "easy" },
 *   { "name": "timeLimit", "value": 120 },
 *   { "name": "shuffleItems", "value": true },
 *   { "name": "hints", "value": null },
 *   { "name": "stimuli", "value": ["word1", "word2", "word3"] }
 * ]
 */
const TaskVariantParametersArraySchema = z.array(TaskVariantParameterSchema).min(1);

export const TaskVariantCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).regex(IDENTIFIER_WITH_HYPHENS),
  parameters: TaskVariantParametersArraySchema,
  description: z.string().trim().min(1).max(1024),
  status: TaskVariantStatusSchema,
});

export const TaskVariantCreateResponseSchema = z.object({
  id: z.string().uuid(),
});

export type TaskVariantStatus = z.infer<typeof TaskVariantStatusSchema>;
export type TaskVariantParameter = z.infer<typeof TaskVariantParameterSchema>;
export type TaskVariantParametersArray = z.infer<typeof TaskVariantParametersArraySchema>;
export type TaskVariantCreateRequest = z.infer<typeof TaskVariantCreateRequestSchema>;
export type TaskVariantCreateResponse = z.infer<typeof TaskVariantCreateResponseSchema>;
