import { z } from 'zod';

/**
 * Query parameters for the FGA sync endpoint.
 *
 * @property dryRun - When true, returns tuple counts without writing to FGA
 */
export const SyncFgaQuerySchema = z.object({
  dryRun: z.coerce.boolean().optional().default(false),
});

export type SyncFgaQuery = z.infer<typeof SyncFgaQuerySchema>;

/**
 * Per-category tuple counts from the sync operation.
 */
export const SyncCategoriesSchema = z.object({
  orgHierarchy: z.number(),
  orgMemberships: z.number(),
  classMemberships: z.number(),
  groupMemberships: z.number(),
  familyMemberships: z.number(),
  administrationAssignments: z.number(),
});

export type SyncCategories = z.infer<typeof SyncCategoriesSchema>;

/**
 * Response body for the FGA sync endpoint.
 */
export const SyncFgaResponseSchema = z.object({
  dryRun: z.boolean(),
  categories: SyncCategoriesSchema,
  totalTuples: z.number(),
});

export type SyncFgaResponse = z.infer<typeof SyncFgaResponseSchema>;

/**
 * Response body when a non-dry-run sync is accepted for async processing.
 */
export const SyncFgaAcceptedSchema = z.object({
  message: z.string(),
});

export type SyncFgaAccepted = z.infer<typeof SyncFgaAcceptedSchema>;
