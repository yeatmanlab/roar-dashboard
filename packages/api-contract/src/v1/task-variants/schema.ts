import { z } from 'zod';
import {
  PaginationQuerySchema,
  SearchQuerySchema,
  createSortQuerySchema,
  createEmbedQuerySchema,
  createFilterQuerySchema,
  createPaginatedResponseSchema,
} from '../common/query';
import { TaskVariantParametersArraySchema, TaskVariantStatusSchema } from '../tasks/schema';

/**
 * Allowed sort fields for the task variants list endpoint.
 * Uses dot-notation namespacing to distinguish fields across the joined tables.
 */
export const TASK_VARIANTS_SORT_FIELDS = [
  'variant.name',
  'variant.createdAt',
  'variant.updatedAt',
  'task.name',
  'task.slug',
] as const;

/**
 * Sort field type for task variants.
 */
export type TaskVariantsSortFieldType = (typeof TASK_VARIANTS_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access.
 */
export const TaskVariantsSortField = {
  VARIANT_NAME: 'variant.name',
  VARIANT_CREATED_AT: 'variant.createdAt',
  VARIANT_UPDATED_AT: 'variant.updatedAt',
  TASK_NAME: 'task.name',
  TASK_SLUG: 'task.slug',
} as const satisfies Record<string, TaskVariantsSortFieldType>;

/**
 * Allowed filter fields for the task variants list endpoint.
 * Uses dot-notation namespacing consistent with the sort fields.
 *
 * Supported operators per field:
 * - `task.id`: `eq`, `in`
 * - `task.slug`: `eq`, `in`
 */
export const TASK_VARIANTS_FILTER_FIELDS = ['task.id', 'task.slug'] as const;

/**
 * Filter field type for task variants.
 */
export type TaskVariantsFilterFieldType = (typeof TASK_VARIANTS_FILTER_FIELDS)[number];

/**
 * Allowed embed options for the task variants list endpoint.
 * - `parameters`: Include the variant's configuration parameters (name/value pairs)
 */
export const TASK_VARIANTS_EMBED_OPTIONS = ['parameters'] as const;

/**
 * Embed option type for task variants.
 */
export type TaskVariantsEmbedOptionType = (typeof TASK_VARIANTS_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access.
 */
export const TaskVariantsEmbedOption = {
  PARAMETERS: 'parameters',
} as const satisfies Record<string, TaskVariantsEmbedOptionType>;

/**
 * Task variant list item schema.
 *
 * Includes denormalized task fields (taskName, taskSlug, taskImage) for
 * convenience — callers do not need a separate task lookup.
 *
 * The `parameters` field is only present when `?embed=parameters` is requested.
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

export type TaskVariantListItem = z.infer<typeof TaskVariantListItemSchema>;

/**
 * Query parameters for the task variants list endpoint.
 *
 * Combines pagination, dotted-notation sort, free-text search, optional
 * parameters embed, and structured filter expressions.
 *
 * Sort fields: `variant.name` (default), `variant.createdAt`, `variant.updatedAt`,
 * `task.name`, `task.slug`.
 *
 * Filter syntax: `field:operator:value` — e.g., `?filter=task.id:eq:some-uuid`.
 * Allowed filter fields: `task.id`, `task.slug`.
 *
 * Search: case-insensitive partial match across variant name, variant description,
 * task name, task slug, and task description.
 */
export const TaskVariantsListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(TASK_VARIANTS_SORT_FIELDS, 'variant.name', 'asc'),
)
  .merge(SearchQuerySchema)
  .merge(createEmbedQuerySchema(TASK_VARIANTS_EMBED_OPTIONS))
  .merge(createFilterQuerySchema(TASK_VARIANTS_FILTER_FIELDS));

export type TaskVariantsListQuery = z.infer<typeof TaskVariantsListQuerySchema>;

/**
 * Paginated response for the task variants list endpoint.
 */
export const TaskVariantsListResponseSchema = createPaginatedResponseSchema(TaskVariantListItemSchema);

export type TaskVariantsListResponse = z.infer<typeof TaskVariantsListResponseSchema>;
