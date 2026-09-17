import { z } from 'zod';
import { TaskVariantStatusSchema, TaskVariantParametersArraySchema } from '../tasks/schema';
import {
  PaginationQuerySchema,
  SearchQuerySchema,
  createSortQuerySchema,
  createPaginatedResponseSchema,
  createEmbedQuerySchema,
  createFilterQuerySchema,
} from '../common/query';

// ─── Sort fields ─────────────────────────────────────────────────────────────

/**
 * Allowed sort fields for the task bundle list endpoint.
 */
export const TASK_BUNDLE_SORT_FIELDS = ['name', 'slug', 'createdAt', 'updatedAt'] as const;

/** Sort field type for task bundles. */
export type TaskBundleSortFieldType = (typeof TASK_BUNDLE_SORT_FIELDS)[number];

/**
 * Sort field constants for type-safe access in service and repository layers.
 */
export const TaskBundleSortField = {
  NAME: 'name',
  SLUG: 'slug',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const satisfies Record<string, TaskBundleSortFieldType>;

// ─── Filter fields ────────────────────────────────────────────────────────────

/**
 * Allowed filter fields for the task bundle list endpoint.
 */
export const TASK_BUNDLE_FILTER_FIELDS = ['taskBundle.slug'] as const;

/** Filter field type for task bundles. */
export type TaskBundleFilterFieldType = (typeof TASK_BUNDLE_FILTER_FIELDS)[number];

// ─── Embed options ────────────────────────────────────────────────────────────

/**
 * Allowed embed options for the task bundle list endpoint.
 */
export const TASK_BUNDLE_EMBED_OPTIONS = ['taskVariantDetails'] as const;

/** Embed option type for task bundles. */
export type TaskBundleEmbedOptionType = (typeof TASK_BUNDLE_EMBED_OPTIONS)[number];

/**
 * Embed option constants for type-safe access in the service layer.
 */
export const TaskBundleEmbedOption = {
  TASK_VARIANT_DETAILS: 'taskVariantDetails',
} as const satisfies Record<string, TaskBundleEmbedOptionType>;

// ─── Variant item schema ──────────────────────────────────────────────────────

/**
 * Schema for a single task variant entry within a task bundle response.
 *
 * The base fields (taskVariantId, taskSlug, taskName, taskVariantName, sortOrder) are always present.
 * The additional fields are only present when `?embed=taskVariantDetails` is requested.
 */
export const TaskBundleVariantItemSchema = z.object({
  // Always present
  taskVariantId: z.string().uuid(),
  taskSlug: z.string(),
  taskName: z.string(),
  taskVariantName: z.string().nullable(),
  sortOrder: z.number().int(),
  // Present only when embed=taskVariantDetails
  taskId: z.string().uuid().optional(),
  taskImage: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: TaskVariantStatusSchema.optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
  parameters: TaskVariantParametersArraySchema.optional(),
});

/** Type for a single variant entry within a task bundle response. */
export type TaskBundleVariantItem = z.infer<typeof TaskBundleVariantItemSchema>;

// ─── Bundle list item schema ──────────────────────────────────────────────────

/**
 * Schema for a single task bundle in list responses.
 * Always includes a summary variant list ordered by sortOrder.
 */
export const TaskBundleListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  taskVariants: z.array(TaskBundleVariantItemSchema),
});

/** Type for a single task bundle list item. */
export type TaskBundleListItem = z.infer<typeof TaskBundleListItemSchema>;

// ─── Query schema ─────────────────────────────────────────────────────────────

/**
 * Query parameters for the task bundle list endpoint.
 * Composes pagination, sort, search, embed, and filter schemas.
 */
export const TaskBundleListQuerySchema = PaginationQuerySchema.merge(
  createSortQuerySchema(TASK_BUNDLE_SORT_FIELDS, 'name', 'asc'),
)
  .merge(SearchQuerySchema)
  .merge(createEmbedQuerySchema(TASK_BUNDLE_EMBED_OPTIONS))
  .merge(createFilterQuerySchema(TASK_BUNDLE_FILTER_FIELDS));

/** Query type for the task bundle list endpoint. */
export type TaskBundleListQuery = z.infer<typeof TaskBundleListQuerySchema>;

// ─── Response schema ──────────────────────────────────────────────────────────

/**
 * Paginated response schema for the task bundle list endpoint.
 */
export const TaskBundlesListResponseSchema = createPaginatedResponseSchema(TaskBundleListItemSchema);

/** Response type for the task bundle list endpoint. */
export type TaskBundlesListResponse = z.infer<typeof TaskBundlesListResponseSchema>;
