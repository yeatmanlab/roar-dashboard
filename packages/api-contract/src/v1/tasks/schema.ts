import { z } from 'zod';
import { JsonValue, parseJsonB } from '../common/parse-jsonb';
import { IDENTIFIER_WITH_SPACES, IDENTIFIER_WITH_UNDERSCORES } from '../common/regex';
import {
  PaginationQuerySchema,
  SearchQuerySchema,
  createSortQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';

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
 * Can be empty to indicate a variant with no configuration parameters.
 *
 * When used in PATCH requests, omitting this field preserves existing parameters,
 * while providing an empty array clears all parameters.
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
const TaskVariantParametersArraySchema = z.array(TaskVariantParameterSchema);

/**
 * Task Variant Create Request Schema
 *
 * Creates a new task variant with the specified configuration.
 *
 * @property name - Unique name for this variant within the parent task
 * @property parameters - Configuration parameters (defaults to empty array if omitted)
 * @property description - Human-readable description of the variant
 * @property status - Publication status of the variant
 */
export const CreateTaskVariantRequestBodySchema = z.object({
  name: z.string().trim().min(1).max(255).regex(IDENTIFIER_WITH_SPACES),
  parameters: TaskVariantParametersArraySchema.default([]),
  description: z.string().trim().min(1).max(1024),
  status: TaskVariantStatusSchema,
});

export const CreateTaskVariantResponseSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Task Variant Update Request Schema
 *
 * Updates an existing task variant. All fields are optional - only provided fields will be updated.
 *
 * @property name - New name for the variant (must remain unique within parent task)
 * @property description - New description for the variant
 * @property status - New publication status
 * @property parameters - New parameters array (omit to keep existing, provide empty array to clear all)
 *
 * @remarks
 * At least one field must be provided. When updating parameters, the entire array replaces
 * the existing parameters - this is not a merge operation.
 */
export const UpdateTaskVariantRequestBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).regex(IDENTIFIER_WITH_SPACES).optional(),
    description: z.string().trim().min(1).max(1024).optional(),
    status: TaskVariantStatusSchema.optional(),
    parameters: TaskVariantParametersArraySchema.optional(),
  })
  .superRefine((payload, ctx) => {
    const updateRequestFields = Object.keys(payload);
    if (updateRequestFields.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of name, description, status, or parameters must be provided.',
      });
    }
  });

/**
 * Task Variant Update Response Schema
 *
 * Returns 204 No Content on successful update.
 * The response body is empty - use a GET request if you need the updated resource.
 */
export const UpdateTaskVariantResponseSchema = z.undefined();

export type TaskVariantStatus = z.infer<typeof TaskVariantStatusSchema>;
export type TaskVariantParameter = z.infer<typeof TaskVariantParameterSchema>;
export type TaskVariantParametersArray = z.infer<typeof TaskVariantParametersArraySchema>;
export type CreateTaskVariantRequestBody = z.infer<typeof CreateTaskVariantRequestBodySchema>;
export type CreateTaskVariantResponse = z.infer<typeof CreateTaskVariantResponseSchema>;
export type UpdateTaskVariantRequestBody = z.infer<typeof UpdateTaskVariantRequestBodySchema>;
export type UpdateTaskVariantResponse = z.infer<typeof UpdateTaskVariantResponseSchema>;

/**
 * Base task schema for list responses.
 */
export const TaskSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  nameSimple: z.string(),
  nameTechnical: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  tutorialVideo: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Allowed sort fields for tasks.
 */
export const TASK_SORT_FIELDS = ['createdAt', 'name', 'slug', 'updatedAt'] as const;

/**
 * Sort field type for tasks.
 */
export type TaskSortFieldType = (typeof TASK_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const TaskSortField = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  SLUG: 'slug',
  UPDATED_AT: 'updatedAt',
} as const satisfies Record<string, TaskSortFieldType>;

/**
 * Query parameters for listing tasks.
 * Supports pagination, sorting, exact slug match, and search (name/description).
 */
export const TasksListQuerySchema = PaginationQuerySchema.merge(createSortQuerySchema(TASK_SORT_FIELDS, 'createdAt'))
  .merge(SearchQuerySchema)
  .extend({
    slug: z.string().optional(),
  });

export type TasksListQuery = z.infer<typeof TasksListQuerySchema>;

/**
 * Paginated response for tasks list.
 */
export const TasksListResponseSchema = createPaginatedResponseSchema(TaskSchema);

export type TasksListResponse = z.infer<typeof TasksListResponseSchema>;
