import { z } from 'zod';
import { JsonValue, ValidatedJsonValue } from '../common/parse-jsonb';
import { IDENTIFIER_WITH_SPACES, IDENTIFIER_WITH_UNDERSCORES } from '../common/regex';
import {
  PaginationQuerySchema,
  SearchQuerySchema,
  createSortQuerySchema,
  createPaginatedResponseSchema,
  createFilterQuerySchema,
  createEmbedQuerySchema,
} from '../common/query';

/**
 * Schema for GET task path parameters.
 * Supports task lookup by task UUID or slug (case-sensitive).
 *
 * @remarks
 * This endpoint accepts either UUID or slug to support both programmatic access
 * (where UUIDs are known) and flexible client-side lookups (where slugs are more user-friendly).
 */
export const GetTaskPathParamSchema = z.object({
  taskId: z.string(),
});

/**
 * Schema for GET task variant path parameters.
 * Supports task variant lookup by task UUID or slug (case-sensitive).
 * Validates that the task variant format matches the database constraints.
 *
 * @remarks
 * This endpoint accepts either UUID or slug to support both programmatic access
 * (where UUIDs are known) and flexible client-side lookups (where slugs are more user-friendly).
 */
export const GetTaskVariantPathParamSchema = z.object({
  taskId: z.string(),
  variantId: z.string().uuid(),
});

/**
 * Schema for POST task variant path parameters.
 * Requires task ID as a valid UUID.
 */
export const CreateTaskVariantPathParamSchema = z.object({
  taskId: z.string().uuid(),
});

/**
 * Schema for PATCH task variant path parameters.
 * Requires both task ID and variant ID as valid UUIDs.
 */
export const UpdateTaskVariantPathParamSchema = z.object({
  taskId: z.string().uuid(),
  variantId: z.string().uuid(),
});

/**
 * Schema for task variant status.
 */
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
/**
 * `ValidatedJsonValue` provides runtime validation (size limits, depth, dangerous keys, etc.)
 * but its inferred TypeScript output type is `Json`. We explicitly annotate the schema as
 * `z.ZodType<{ name: string; value: unknown }>` so the output stays `unknown` — consistent
 * with how Drizzle types `jsonb()` columns — while the security checks still run at parse time.
 */
const TaskVariantParameterSchema: z.ZodType<{ name: string; value: unknown }> = z.object({
  name: z.string().min(1).max(255).regex(IDENTIFIER_WITH_UNDERSCORES),
  value: ValidatedJsonValue,
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
export const TaskVariantParametersArraySchema = z.array(TaskVariantParameterSchema);

/**
 * Schema for a task variant in list responses.
 * Includes denormalized task fields and parameters for convenience.
 */
export const TaskVariantSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  status: TaskVariantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  taskName: z.string(),
  taskSlug: z.string(),
  taskImage: z.string().nullable(),
  parameters: TaskVariantParametersArraySchema,
});

/**
 * Task-variant type
 */
export type TaskVariant = z.infer<typeof TaskVariantSchema>;

/**
 * Response schema for get operations on task-variants.
 * Allows for better semantic clarity and facilitates easier API development.
 */
export const GetTaskVariantResponseSchema = TaskVariantSchema;

/**
 * Allowed sort fields for task variants.
 */
export const TASK_VARIANT_SORT_FIELDS = ['createdAt', 'name', 'updatedAt', 'status'] as const;

/**
 * Sort field type for task variants.
 */
export type TaskVariantSortFieldType = (typeof TASK_VARIANT_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const TaskVariantSortField = {
  CREATED_AT: 'createdAt',
  NAME: 'name',
  UPDATED_AT: 'updatedAt',
  STATUS: 'status',
} as const satisfies Record<string, TaskVariantSortFieldType>;

/**
 * Query parameters for listing task variants.
 * Supports pagination, sorting, search (name/description), and status filtering.
 */
export const ListTaskVariantsQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(TASK_VARIANT_SORT_FIELDS, 'name', 'asc'),
)
  .merge(SearchQuerySchema)
  .merge(
    z.object({
      status: TaskVariantStatusSchema.optional(),
    }),
  );

/**
 * Paginated response for task variants list.
 */
export const ListTaskVariantsResponseSchema = createPaginatedResponseSchema(TaskVariantSchema);

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
  name: z.string().trim().min(1).max(255).regex(IDENTIFIER_WITH_SPACES).optional(),
  parameters: TaskVariantParametersArraySchema.default([]),
  description: z.string().trim().min(1).max(1024).optional(),
  status: TaskVariantStatusSchema,
});

/**
 * Response schema for create operations on task-variants
 * Returns the ID of the newly created variant.
 */
export const CreateTaskVariantResponseSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Task Variant Update Request Schema
 *
 * Updates an existing task variant. All fields are optional - only provided fields will be updated.
 *
 * @property name - New name for the variant (must remain unique within parent task), or null to clear it
 * @property description - New description for the variant, or null to clear it
 * @property status - New publication status
 * @property parameters - New parameters array (omit to keep existing, provide empty array to clear all)
 *
 * @remarks
 * At least one field must be provided. When updating parameters, the entire array replaces
 * the existing parameters - this is not a merge operation.
 */
export const UpdateTaskVariantRequestBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).regex(IDENTIFIER_WITH_SPACES).nullish(),
    description: z.string().trim().min(1).max(1024).nullish(),
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

/** Task variant status type. */
export type TaskVariantStatus = z.infer<typeof TaskVariantStatusSchema>;

/** Single task variant parameter type. */
export type TaskVariantParameter = z.infer<typeof TaskVariantParameterSchema>;

/** Array of task variant parameters type. */
export type TaskVariantParametersArray = z.infer<typeof TaskVariantParametersArraySchema>;

/** Query parameters for listing task variants. */
export type ListTaskVariantsQuery = z.infer<typeof ListTaskVariantsQuerySchema>;

/** Paginated response type for listing task variants. */
export type ListTaskVariantsResponse = z.infer<typeof ListTaskVariantsResponseSchema>;

/** Response type for GET task variant endpoint. */
export type GetTaskVariantResponse = z.infer<typeof GetTaskVariantResponseSchema>;

/** Request body type for creating a task variant. */
export type CreateTaskVariantRequestBody = z.infer<typeof CreateTaskVariantRequestBodySchema>;

/** Response type for creating a task variant. */
export type CreateTaskVariantResponse = z.infer<typeof CreateTaskVariantResponseSchema>;

/** Request body type for updating a task variant. */
export type UpdateTaskVariantRequestBody = z.infer<typeof UpdateTaskVariantRequestBodySchema>;

/** Response type for updating a task variant. */
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
  taskConfig: JsonValue,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

/**
 * Task type
 */
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
export const TasksListQuerySchema = PaginationQuerySchema.merge(createSortQuerySchema(TASK_SORT_FIELDS, 'name', 'asc'))
  .merge(SearchQuerySchema)
  .extend({
    slug: z.string().optional(),
  });

/**
 * Type for querying during list operations on tasks.
 */
export type TasksListQuery = z.infer<typeof TasksListQuerySchema>;

/**
 * Paginated response for tasks list.
 */
export const TasksListResponseSchema = createPaginatedResponseSchema(TaskSchema);

/**
 * Response type for list operations on tasks.
 */
export type TasksListResponse = z.infer<typeof TasksListResponseSchema>;

/**
 * Type for GET task path parameters (UUID or slug).
 */
export type GetTaskPathParam = z.infer<typeof GetTaskPathParamSchema>;

/**
 * Type for task variant path parameters in path operations.
 */
export type GetTaskVariantPathParam = z.infer<typeof GetTaskVariantPathParamSchema>;

/**
 * Type for task variant path parameters in create operations.
 */
export type CreateTaskVariantPathParam = z.infer<typeof CreateTaskVariantPathParamSchema>;

/**
 * Type for task variant path parameters in update operations.
 */

export type UpdateTaskVariantPathParam = z.infer<typeof UpdateTaskVariantPathParamSchema>;

/**
 * Slug format regex: lowercase alphanumeric with hyphens between segments.
 * Must match the database constraint: ^[a-z0-9]+(-[a-z0-9]+)*$
 *
 * Examples: "swr", "letter-task", "phoneme-awareness-1"
 */
const TASK_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Task Create Request Schema
 *
 * Creates a new task with the specified configuration.
 *
 * @property slug - URL-friendly identifier (lowercase alphanumeric with hyphens, max 32 chars)
 * @property name - Display name for the task
 * @property nameSimple - Simplified name for the task
 * @property nameTechnical - Technical/internal name for the task
 * @property taskConfig - JSON configuration object for the task
 * @property description - Optional human-readable description
 * @property image - Optional URL to task image
 * @property tutorialVideo - Optional URL to tutorial video
 */
export const CreateTaskRequestBodySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .max(32, 'Slug must be at most 32 characters')
      .regex(TASK_SLUG_REGEX, 'Slug must be lowercase alphanumeric with hyphens (e.g., "my-task")'),
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(255)
      .regex(IDENTIFIER_WITH_SPACES, 'Name must be alphanumeric with spaces (e.g., "My Task")'),
    nameSimple: z
      .string()
      .trim()
      .min(1, 'Simple name is required')
      .max(255)
      .regex(IDENTIFIER_WITH_SPACES, 'Simple name must be alphanumeric with spaces (e.g., "My Task")'),
    nameTechnical: z
      .string()
      .trim()
      .min(1, 'Technical name is required')
      .max(255)
      .regex(IDENTIFIER_WITH_SPACES, 'Technical name must be alphanumeric with spaces (e.g., "My Task")'),
    taskConfig: ValidatedJsonValue,
    description: z.string().trim().min(1).max(1024).nullish(),
    image: z.string().url('Image must be a valid URL').nullish(),
    tutorialVideo: z.string().url('Tutorial video must be a valid URL').nullish(),
  })
  .strict();

export const CreateTaskResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateTaskRequestBody = z.infer<typeof CreateTaskRequestBodySchema>;
export type CreateTaskResponse = z.infer<typeof CreateTaskResponseSchema>;

// ─── Task Variants List (cross-task, super-admin only) ──────────────────────

/**
 * Allowed sort fields for the cross-task variant list endpoint.
 * Uses dotted notation to distinguish variant and task fields.
 */
export const TASK_VARIANTS_SORT_FIELDS = [
  'variant.name',
  'variant.createdAt',
  'variant.updatedAt',
  'task.name',
  'task.slug',
] as const;

/** Sort field type for the cross-task variant list. */
export type TaskVariantsSortFieldType = (typeof TASK_VARIANTS_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access in service and repository layers.
 */
export const TaskVariantsSortField = {
  VARIANT_NAME: 'variant.name',
  VARIANT_CREATED_AT: 'variant.createdAt',
  VARIANT_UPDATED_AT: 'variant.updatedAt',
  TASK_NAME: 'task.name',
  TASK_SLUG: 'task.slug',
} as const satisfies Record<string, TaskVariantsSortFieldType>;

/**
 * Allowed filter fields for the cross-task variant list endpoint.
 */
export const TASK_VARIANTS_FILTER_FIELDS = ['task.id', 'task.slug'] as const;

/** Filter field type for the cross-task variant list. */
export type TaskVariantsFilterFieldType = (typeof TASK_VARIANTS_FILTER_FIELDS)[number];

/**
 * Allowed embed options for the cross-task variant list endpoint.
 */
export const TASK_VARIANTS_EMBED_OPTIONS = ['parameters'] as const;

/** Embed option type for the cross-task variant list. */
export type TaskVariantsEmbedOptionType = (typeof TASK_VARIANTS_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access in the service layer.
 */
export const TaskVariantsEmbedOption = {
  PARAMETERS: 'parameters',
} as const satisfies Record<string, TaskVariantsEmbedOptionType>;

/**
 * Schema for a single item in the cross-task variant list response.
 * Extends the base variant shape with denormalized task fields and optional parameters.
 *
 * `parameters` is only present when `?embed=parameters` is requested.
 */
export const TaskVariantListItemSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  status: TaskVariantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  taskName: z.string(),
  taskSlug: z.string(),
  taskImage: z.string().nullable(),
  parameters: TaskVariantParametersArraySchema.optional(),
});

/** Type for a single item in the cross-task variant list response. */
export type TaskVariantListItem = z.infer<typeof TaskVariantListItemSchema>;

/**
 * Query parameters for the cross-task published variant list endpoint.
 * Composes pagination, sort, search, embed, and filter schemas.
 */
export const TaskVariantsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(TASK_VARIANTS_SORT_FIELDS, 'variant.name', 'asc'),
)
  .merge(SearchQuerySchema)
  .merge(createEmbedQuerySchema(TASK_VARIANTS_EMBED_OPTIONS))
  .merge(createFilterQuerySchema(TASK_VARIANTS_FILTER_FIELDS));

/** Query type for the cross-task variant list endpoint. */
export type TaskVariantsListQuery = z.infer<typeof TaskVariantsListQuerySchema>;

/**
 * Paginated response schema for the cross-task variant list endpoint.
 */
export const TaskVariantsListResponseSchema = createPaginatedResponseSchema(TaskVariantListItemSchema);

/** Response type for the cross-task variant list endpoint. */
export type TaskVariantsListResponse = z.infer<typeof TaskVariantsListResponseSchema>;
